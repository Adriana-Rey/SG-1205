(() => {
  "use strict";

  const SUPABASE_URL = "COLE_AQUI_A_URL_DO_SUPABASE";
  const SUPABASE_ANON_KEY = "COLE_AQUI_A_ANON_KEY_DO_SUPABASE";
  const PHOTO_BUCKET = "fotos-sg1205";
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(SUPABASE_URL)
    && !SUPABASE_ANON_KEY.startsWith("COLE_AQUI");
  const client = configured && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.sessionStorage
        }
      })
    : null;

  const normalizeItem = (row) => {
    const source = row.dados && typeof row.dados === "object" ? { ...row.dados, id: row.id } : row;
    const aliases = {
      replica_metalografica: "replicaMetalografica",
      lp_resp: "lpResp",
      pm_resp: "pmResp",
      me_resp: "meResp",
      cp_resp: "cpResp",
      iris_resp: "irisResp",
      us_resp: "usResp",
      evs_resp: "evsResp",
      lp_qualidade: "lpQualidade",
      pm_qualidade: "pmQualidade",
      us_qualidade: "usQualidade",
      plano_torque: "planoTorque",
      relatorio_torque: "relatorioTorque",
      isolamento_refratario: "isolamentoRefratario",
      registro_fotografico: "registroFotografico"
    };
    return Object.entries(source).reduce((item, [key, value]) => {
      item[aliases[key] || key] = value;
      return item;
    }, {});
  };

  const usernameEmail = (username) => {
    const slug = String(username || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "");
    return `${slug}@sg1205.local`;
  };

  const getUsername = (user) => user?.user_metadata?.username
    || user?.email?.split("@")[0]
    || null;

  const mapPhoto = (row) => {
    const { data } = client.storage.from(PHOTO_BUCKET).getPublicUrl(row.caminho);
    return {
      id: row.id,
      taskId: Number(row.item_id),
      name: row.nome,
      createdAt: new Date(row.criado_em).getTime(),
      dataUrl: data.publicUrl,
      path: row.caminho
    };
  };

  const api = {
    configured,
    client,
    photoBucket: PHOTO_BUCKET,

    async loadItems() {
      const { data, error } = await client.from("itens_sg1205").select("*").order("id");
      if (error) throw error;
      return (data || []).map(normalizeItem);
    },

    async loadEdits() {
      const { data, error } = await client.from("alteracoes_sg1205").select("*");
      if (error) throw error;
      return Object.fromEntries((data || []).map((row) => [
        Number(row.item_id),
        {
          ...(row.dados || {}),
          observacao: row.observacao || "",
          completionAudit: row.auditoria_conclusao || {}
        }
      ]));
    },

    async saveEdit(taskId, update, username) {
      const { observacao = "", completionAudit = {}, ...dados } = update;
      const { error } = await client.from("alteracoes_sg1205").upsert({
        item_id: Number(taskId),
        dados,
        observacao,
        auditoria_conclusao: completionAudit,
        usuario: username,
        atualizado_em: new Date().toISOString()
      }, { onConflict: "item_id" });
      if (error) throw error;
    },

    async deleteEdit(taskId) {
      const { error } = await client.from("alteracoes_sg1205").delete().eq("item_id", Number(taskId));
      if (error) throw error;
    },

    async loadHistory() {
      const { data, error } = await client.from("historico_sg1205")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []).map((row) => ({
        taskId: Number(row.item_id),
        item: row.item,
        equipamento: row.equipamento,
        field: row.campo,
        status: row.status,
        user: row.usuario,
        at: row.criado_em
      }));
    },

    async appendHistory(entries) {
      if (!entries.length) return;
      const rows = entries.map((entry) => ({
        item_id: Number(entry.taskId),
        item: String(entry.item || ""),
        equipamento: entry.equipamento || "",
        campo: entry.field,
        status: entry.status,
        usuario: entry.user,
        criado_em: entry.at
      }));
      const { error } = await client.from("historico_sg1205").insert(rows);
      if (error) throw error;
    },

    async getCurrentUser() {
      const { data, error } = await client.auth.getUser();
      if (error) return null;
      return data?.user ? {
        username: getUsername(data.user),
        mustChangePassword: Boolean(data.user.user_metadata?.must_change_password)
      } : null;
    },

    async signIn(username, password) {
      const { data, error } = await client.auth.signInWithPassword({
        email: usernameEmail(username),
        password
      });
      if (error) throw error;
      return {
        username: getUsername(data.user),
        mustChangePassword: Boolean(data.user?.user_metadata?.must_change_password)
      };
    },

    async signUp(username, password) {
      const { data, error } = await client.auth.signUp({
        email: usernameEmail(username),
        password,
        options: { data: { username, must_change_password: true } }
      });
      if (error) throw error;
      return {
        username,
        hasSession: Boolean(data.session),
        mustChangePassword: true
      };
    },

    async changePassword(password) {
      const current = await this.getCurrentUser();
      const { error } = await client.auth.updateUser({
        password,
        data: { username: current?.username, must_change_password: false }
      });
      if (error) throw error;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async getTaskPhotos(taskId) {
      const { data, error } = await client.from("fotos_sg1205")
        .select("*")
        .eq("item_id", Number(taskId))
        .order("criado_em");
      if (error) throw error;
      return (data || []).map(mapPhoto);
    },

    async loadPhotoTaskIds() {
      const { data, error } = await client.from("fotos_sg1205").select("item_id");
      if (error) throw error;
      return new Set((data || []).map((row) => Number(row.item_id)));
    },

    async uploadPhoto(photo, username) {
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      const path = `${photo.taskId}/${photo.id}.jpg`;
      const { error: uploadError } = await client.storage.from(PHOTO_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await client.from("fotos_sg1205").insert({
        id: photo.id,
        item_id: Number(photo.taskId),
        caminho: path,
        nome: photo.name,
        usuario: username,
        criado_em: new Date(photo.createdAt).toISOString()
      }).select().single();
      if (error) {
        await client.storage.from(PHOTO_BUCKET).remove([path]);
        throw error;
      }
      return mapPhoto(data);
    },

    async removePhoto(photoId) {
      const { data, error } = await client.from("fotos_sg1205")
        .select("caminho")
        .eq("id", photoId)
        .single();
      if (error) throw error;
      const { error: storageError } = await client.storage.from(PHOTO_BUCKET).remove([data.caminho]);
      if (storageError) throw storageError;
      const { error: deleteError } = await client.from("fotos_sg1205").delete().eq("id", photoId);
      if (deleteError) throw deleteError;
    },

    async removeTaskPhotos(taskId) {
      const photos = await this.getTaskPhotos(taskId);
      if (!photos.length) return;
      const { error: storageError } = await client.storage.from(PHOTO_BUCKET)
        .remove(photos.map((photo) => photo.path));
      if (storageError) throw storageError;
      const { error } = await client.from("fotos_sg1205").delete().eq("item_id", Number(taskId));
      if (error) throw error;
    },

    subscribe(onChange) {
      return client.channel("sg1205-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "itens_sg1205" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "alteracoes_sg1205" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "historico_sg1205" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "fotos_sg1205" }, onChange)
        .subscribe();
    }
  };

  window.SG1205_SUPABASE = api;
})();
