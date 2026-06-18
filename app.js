(() => {
  "use strict";

  const fallbackTasks = window.SG1205_DATA || [];
  let tasks = fallbackTasks;
  let metadata = window.SG1205_META || {};
  const supabaseApi = window.SG1205_SUPABASE || { configured: false };
  const authAvailable = Boolean(supabaseApi.configured && supabaseApi.client);
  const defaultPassword = "senha1234";
  const pageSize = 12;
  const checkFields = [
    ["executante", "EXECUTANTE"],
    ["visual", "VISUAL"], ["replicaMetalografica", "RÉP MET"],
    ["lpResp", "LP-I"], ["pmResp", "PM-I"],
    ["meResp", "ME"], ["cpResp", "CP"], ["irisResp", "ÍRIS"],
    ["usResp", "US-I"], ["evsResp", "EVS"],
    ["ieis", "IEIS"],
    ["lpQualidade", "LP-Q"], ["pmQualidade", "PM-Q"],
    ["usQualidade", "US-Q"], ["rx", "RX"], ["ttat", "TTAT"],
    ["dureza", "DUREZA"], ["planoTorque", "PLANO TORQUE"],
    ["relatorioTorque", "REL TORQUE"], ["petp", "PETP"], ["th", "TH"],
    ["isolamentoRefratario", "ISOL REFRAT"], ["registroFotografico", "REG FOT"],
    ["lv", "LV"], ["producao", "PRODUÇÃO"]
  ];
  const statusOptions = ["CONC", "PEND", "AND", "N.A", "CANC"];
  const numericControlFields = new Set(["petp", "ieis", "planoTorque"]);
  const progressFields = checkFields.filter(([field]) => !numericControlFields.has(field));
  const primaryOwners = new Set(["AMILTON", "EDILSON", "MINEIRO"]);
  const executionOnlyUsers = new Set(["AMILTON", "ELIAS", "ERON", "ERONILDES", "EDILSON"]);
  let numericOptionsByField = {};
  const controlGroups = [
    {
      title: "Execução",
      fields: ["executante"]
    },
    {
      title: "Qualidade",
      fields: ["evsResp", "ieis", "lpQualidade", "pmQualidade", "usQualidade", "rx", "ttat", "dureza", "planoTorque", "relatorioTorque", "petp", "th", "isolamentoRefratario", "registroFotografico", "lv"]
    },
    {
      title: "Integridade",
      fields: ["visual", "replicaMetalografica", "lpResp", "pmResp", "meResp", "cpResp", "irisResp", "usResp"]
    },
    {
      title: "Produção",
      fields: ["producao"]
    }
  ];
  const visualGroups = [
    { title: "Duto de ar frio", x: 3.3, y: 16.5, items: ["13080"] },
    { title: "Caixa de ar", x: 3.3, y: 25.5, items: ["13071", "13088"] },
    { title: "Coletores laterais", x: 3.3, y: 34.5, items: ["13062"] },
    { title: "PAV", x: 3.3, y: 42.5, items: ["13087", "13119", "13204", "13205", "13206"] },
    { title: "Queimadores", x: 3.3, y: 61.5, items: ["13082", "13125", "13142", "13192", "13193", "13196"] },
    { title: "PSV", x: 48.5, y: 4.5, items: ["13132", "13133", "13134", "13135", "13136", "13137", "13181", "13497"] },
    { title: "Tubul\u00e3o Inferior/ Superior", items: ["13055", "13074", "13085", "13092", "13124", "13122", "13151", "13217", "13218", "13221", "13093", "13116", "13123"] },
    { title: "Superaquecedor", x: 67.5, y: 5, items: ["13055", "13062", "13075", "13076"] },
    { title: "Dessuperaquecedor", x: 67.5, y: 15, items: ["13056", "13097", "13061", "13094", "13095", "13127", "13220"] },
    { title: "Chamine", x: 87.5, y: 17, items: ["13084"] },
    { title: "Supply", x: 73, y: 25, items: ["13077"] },
    { title: "Bank", x: 73, y: 31, items: ["13055", "13057", "13058", "13120", "13128"] },
    { title: "PAG", x: 73, y: 42, items: ["13118", "13186", "13121", "13176", "13182"] },
    { title: "Buck-Stay", x: 73, y: 56, items: ["13073", "13079", "13091"] },
    { title: "Fornalha", x: 42.5, y: 43, items: ["13055", "13059", "13060", "13062", "13063", "13064", "13065", "13066", "13067", "13069", "13143", "13144", "13126", "13207", "13219", "13223"] },
    { title: "Duto de gas quente", x: 86.5, y: 65, items: ["13089", "13090", "13081", "13096"] },
    { title: "Duto de gas frio", x: 87.5, y: 80, items: ["13081"] },
    { title: "Coletor inferior", x: 63.5, y: 86.5, items: ["13070"] },
    { title: "Duto de ar quente", x: 16, y: 86, items: ["13080"] }
  ];
  const peripheralOrder = [
    "B-1251", "D-1207", "D-1247", "TB-1251",
    "MB-1251", "PERMUTADOR AMOSTRA", "RESFRIADOR", "V\u00c1LVULA",
    "E-1202", "INSTRUMENTA\u00c7\u00c3O", "TUBULA\u00c7\u00c3O",
    "SG-1205"
  ];
  const boilerColumns = [
    ["Duto de ar frio", "Caixa de ar", "Coletores laterais", "PAV", "Queimadores", "Duto de ar quente"],
    ["PSV", "Superaquecedor", "Dessuperaquecedor", "Supply", "Bank"],
    ["Chamine", "PAG", "Buck-Stay", "Duto de gas quente", "Duto de gas frio", "Coletor inferior"],
    ["Tubul\u00e3o Inferior/ Superior", "Fornalha"]
  ];

  let edits = {};
  let reportEntriesCache = [];
  let currentUser = null;
  let mustChangePassword = false;
  let onlineMode = false;
  let realtimeChannel = null;
  let realtimeTimer = null;
  let fallbackPhotos = [];
  let photoTaskIds = new Set();
  let activePrintMode = null;
  let printPageStyle = null;
  let currentPhotos = [];
  let state = { view: "dashboard", search: "", tag: "", equipment: "", area: "", owner: "", status: "", reportDate: "", page: 1, currentId: null };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
  const keyText = (value) => normalize(value).toLocaleLowerCase("pt-BR");
  const taskIdentity = (task) => [
    keyText(task.equipamento),
    keyText(task.item),
    keyText(task.descricao)
  ].join("|");
  const isPending = (value) => keyText(value) === "pend";
  const isApplicable = (value) => value !== null && value !== "" && !["n.a", "-", "canc"].includes(keyText(value));

  function rebuildNumericOptions() {
    numericOptionsByField = Object.fromEntries([...numericControlFields].map((field) => [
      field,
      [...new Set(tasks.map((task) => String(task[field] ?? "").trim()).filter((value) => /^\d+(?:[.,]\d+)?$/.test(value)))]
        .sort((a, b) => Number(a.replace(",", ".")) - Number(b.replace(",", ".")))
    ]));
  }

  function loadEdits() {
    return edits;
  }

  function loadReport() {
    return reportEntriesCache;
  }

  function remoteResetAt() {
    return metadata.resetAt || (metadata.exportedAt ? `${metadata.exportedAt}T00:00:00` : "");
  }

  function reportObservation(entry) {
    if (keyText(entry.field) === "executante" && keyText(entry.status) === "conc") {
      return entry.observation || "Aguardando CQ";
    }
    return entry.observation || "";
  }

  async function appendReportEntries(entries) {
    if (!entries.length) return;
    if (onlineMode) await supabaseApi.appendHistory(entries);
    reportEntriesCache = [...reportEntriesCache, ...entries].slice(-5000);
  }

  function renderAuth() {
    $("#loginButton").textContent = currentUser || "Entrar";
    $("#loginButton").classList.toggle("signed-in", Boolean(currentUser));
    $("#logoutButton").hidden = !currentUser;
    $("#editingIdentity").textContent = currentUser
      ? `Alterações registradas por ${currentUser}`
      : "Entre para registrar alterações";
  }

  function openLogin() {
    $("#loginMessage").textContent = "";
    $("#loginPassword").value = "";
    $("#loginDialog").showModal();
    $("#loginUsername").focus();
  }

  async function registerUser() {
    const username = normalize($("#loginUsername").value);
    const password = $("#loginPassword").value;
    if (username.length < 3 || password.length < 6 || password.length > 19) {
      $("#loginMessage").textContent = "Informe usuário com 3 caracteres e senha entre 6 e 19 caracteres.";
      return;
    }
    if (!authAvailable) {
      $("#loginMessage").textContent = "Cadastros exigem conexão com o Supabase.";
      return;
    }
    try {
      const result = await supabaseApi.signUp(username, password);
      if (!result.hasSession) {
        $("#loginMessage").textContent = "Usuário criado. Confirme o cadastro ou desative Confirm email no Supabase.";
        return;
      }
      currentUser = result.username;
      mustChangePassword = true;
      $("#loginDialog").close();
      $("#changePasswordDialog").showModal();
      renderAuth();
    } catch (error) {
      $("#loginMessage").textContent = error.message || "Não foi possível cadastrar o usuário.";
    }
  }

  async function recoverPassword() {
    const username = normalize($("#loginUsername").value);
    if (username.length < 3) {
      $("#loginMessage").textContent = "Informe o usuário para recuperar a senha.";
      return;
    }
    if (!authAvailable) {
      $("#loginMessage").textContent = "Recuperação indisponível: configure a conexão com o Supabase.";
      return;
    }
    try {
      await supabaseApi.resetPassword(username);
      $("#loginMessage").textContent = "Link de recuperação enviado para o e-mail do usuário.";
    } catch (error) {
      $("#loginMessage").textContent = error.message || "Não foi possível enviar a recuperação de senha.";
    }
  }

  async function login(event) {
    event.preventDefault();
    const username = normalize($("#loginUsername").value);
    const password = $("#loginPassword").value;
    if (!authAvailable) {
      $("#loginMessage").textContent = supabaseApi.configurationError
        || "Login indisponível: configure a conexão com o Supabase.";
      return;
    }
    try {
      const user = await supabaseApi.signIn(username, password);
      currentUser = user.username;
      mustChangePassword = user.mustChangePassword;
      $("#loginDialog").close();
      if (user.mustChangePassword) {
        $("#changePasswordMessage").textContent = "";
        $("#newPassword").value = "";
        $("#confirmPassword").value = "";
        $("#changePasswordDialog").showModal();
        $("#newPassword").focus();
      } else {
        renderAuth();
        showToast(`Conectado como ${currentUser}.`);
      }
    } catch {
      $("#loginMessage").textContent = "Usuário ou senha inválidos.";
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    const password = $("#newPassword").value;
    const confirmation = $("#confirmPassword").value;
    if (password.length < 6) {
      $("#changePasswordMessage").textContent = "A nova senha deve ter pelo menos 6 caracteres.";
      return;
    }
    if (password.length > 19) {
      $("#changePasswordMessage").textContent = "A nova senha deve ter no máximo 19 caracteres.";
      return;
    }
    if (password === defaultPassword) {
      $("#changePasswordMessage").textContent = "Escolha uma senha diferente da senha inicial.";
      return;
    }
    if (password !== confirmation) {
      $("#changePasswordMessage").textContent = "As senhas não conferem.";
      return;
    }
    try {
      await supabaseApi.changePassword(password);
      mustChangePassword = false;
      $("#changePasswordDialog").close();
      renderAuth();
      showToast("Senha alterada. Acesso liberado.");
    } catch (error) {
      $("#changePasswordMessage").textContent = error.message || "Não foi possível alterar a senha.";
    }
  }

  async function logout() {
    if (authAvailable) await supabaseApi.signOut();
    currentUser = null;
    mustChangePassword = false;
    renderAuth();
    showToast("Sessão encerrada.");
  }

  function mergedTask(task) {
    const localEdit = { ...(edits[task.id] || {}) };
    delete localEdit.responsavel;
    numericControlFields.forEach((field) => delete localEdit[field]);
    return { ...task, ...localEdit };
  }

  function canEditOnlyExecution() {
    return executionOnlyUsers.has(normalize(currentUser).toLocaleUpperCase("pt-BR"));
  }

  function taskMetrics(task) {
    const values = progressFields.map(([field]) => task[field]);
    const pending = values.filter(isPending).length;
    const completed = values.filter((value) => keyText(value) === "conc").length;
    const inProgress = values.filter((value) => keyText(value) === "and").length;
    const canceled = values.filter((value) => keyText(value) === "canc").length;
    const applicable = values.filter(isApplicable).length;
    return { pending, completed, inProgress, canceled, applicable };
  }

  function taskStatus(metrics, task) {
    if (task && !primaryOwners.has(normalize(task.responsavel).toLocaleUpperCase("pt-BR"))) {
      return { key: "other", label: "Outros" };
    }
    if (task && keyText(task.executante) === "conc") {
      const cqValues = progressFields
        .map(([field]) => field)
        .filter((field) => !["executante", "producao"].includes(field))
        .map((field) => task[field]);
      const cqApplicable = cqValues.filter(isApplicable);
      const cqCompleted = cqApplicable.filter((value) => keyText(value) === "conc");
      if (!cqApplicable.length || cqCompleted.length < cqApplicable.length) {
        return { key: "progress", label: "Andamento" };
      }
    }
    if (metrics.inProgress > 0) return { key: "progress", label: "Andamento" };
    if (metrics.canceled > 0 && metrics.pending === 0 && metrics.completed === 0) {
      return { key: "canceled", label: "Cancelada" };
    }
    if (metrics.canceled > 0 && metrics.pending > 0 && metrics.completed === 0) {
      return { key: "pending", label: "Pendente" };
    }
    if (metrics.canceled > 0 && metrics.completed > 0 && metrics.pending === 0) {
      return { key: "clear", label: "Concluído" };
    }
    if (metrics.pending === 0) return { key: "clear", label: "Concluído" };
    if (metrics.pending < metrics.applicable) return { key: "progress", label: "Andamento" };
    return { key: "pending", label: "Pendente" };
  }

  function unique(field) {
    return [...new Set(tasks.map((task) => normalize(mergedTask(task)[field])).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function populateFilters() {
    fillSelect($("#tagFilter"), unique("tag"));
    fillSelect($("#equipmentFilter"), unique("equipamento"));
    fillSelect($("#areaFilter"), unique("cq"));
    const ownerOrder = new Map([["AMILTON", 0], ["EDILSON", 1], ["MINEIRO", 2]]);
    const owners = unique("responsavel").sort((a, b) => {
      const aOrder = ownerOrder.get(normalize(a).toLocaleUpperCase("pt-BR")) ?? 99;
      const bOrder = ownerOrder.get(normalize(b).toLocaleUpperCase("pt-BR")) ?? 99;
      return aOrder - bOrder || a.localeCompare(b, "pt-BR");
    });
    fillSelect($("#ownerFilter"), owners);
  }

  function fillSelect(select, values) {
    [...select.options].slice(1).forEach((option) => option.remove());
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  }

  function getFilteredTasks() {
    const search = keyText(state.search);
    return tasks.map(mergedTask).filter((task) => {
      const metrics = taskMetrics(task);
      const haystack = keyText([task.tag, task.equipamento, task.item, task.descricao, task.responsavel, task.observacao].join(" "));
      return (!search || haystack.includes(search))
        && (!state.tag || normalize(task.tag) === state.tag)
        && (!state.equipment || normalize(task.equipamento) === state.equipment)
        && (!state.area || normalize(task.cq) === state.area)
        && (!state.owner || normalize(task.responsavel) === state.owner)
        && (!state.status || taskStatus(metrics, task).key === state.status);
    });
  }

  function renderDashboard() {
    const current = tasks.map(mergedTask);
    const progressTasks = current.filter((task) =>
      primaryOwners.has(normalize(task.responsavel).toLocaleUpperCase("pt-BR"))
    );
    const metrics = progressTasks.map(taskMetrics);
    const statuses = progressTasks.map((task, index) => taskStatus(metrics[index], task));
    const pendingTasks = statuses.filter((item) => item.key === "pending").length;
    const clearTasks = statuses.filter((item) => item.key === "clear").length;
    const canceledTasks = statuses.filter((item) => item.key === "canceled").length;
    const inProgressTasks = statuses.filter((item) => item.key === "progress").length;
    const otherTasks = current.filter((task) =>
      !primaryOwners.has(normalize(task.responsavel).toLocaleUpperCase("pt-BR"))
    ).length;
    const totalForProgress = pendingTasks + clearTasks;
    const totalActivities = pendingTasks + inProgressTasks + clearTasks + canceledTasks;
    const progress = totalForProgress ? Math.round((clearTasks / totalForProgress) * 100) : 0;
    const pendingDegrees = totalActivities ? (pendingTasks / totalActivities) * 360 : 0;
    const inProgressDegrees = totalActivities ? (inProgressTasks / totalActivities) * 360 : 0;
    const completedDegrees = totalActivities ? (clearTasks / totalActivities) * 360 : 0;
    $("#totalTasks").textContent = progressTasks.length;
    $("#navTaskCount").textContent = current.length;
    $("#totalTags").textContent = `${progressTasks.length} itens no resumo`;
    $("#pendingTasks").textContent = pendingTasks;
    $("#pendingRate").textContent = `${progressTasks.length ? Math.round((pendingTasks / progressTasks.length) * 100) : 0}% dos itens`;
    $("#clearTasks").textContent = clearTasks;
    $("#canceledTasks").textContent = canceledTasks;
    $("#progressTasks").textContent = inProgressTasks;
    $("#otherTasks").textContent = otherTasks;
    $("#progressPercent").textContent = `${progress}%`;
    $("#progressPending").textContent = pendingTasks;
    $("#progressInProgress").textContent = inProgressTasks;
    $("#progressCompleted").textContent = clearTasks;
    $("#progressCanceled").textContent = canceledTasks;
    $("#progressRing").style.setProperty("--pending-end", `${pendingDegrees}deg`);
    $("#progressRing").style.setProperty("--progress-end", `${pendingDegrees + inProgressDegrees}deg`);
    $("#progressRing").style.setProperty("--completed-end", `${pendingDegrees + inProgressDegrees + completedDegrees}deg`);

    renderCheckChart(progressTasks);
    renderOwners(current);
    renderEquipment(current);
    renderAreaSummary(current);
  }

  function renderVisualMarkers() {
    const hasCanceledControl = (task) => progressFields.some(([field]) =>
      keyText(task[field]) === "canc"
    );
    const visualTaskState = (task) => hasCanceledControl(task)
      ? "canceled"
      : taskStatus(taskMetrics(task), task).key;
    const current = tasks.map(mergedTask).filter((task) =>
      primaryOwners.has(normalize(task.responsavel).toLocaleUpperCase("pt-BR"))
    );
    const byItem = current.reduce((groups, task) => {
      const item = normalize(task.item);
      if (!groups[item]) groups[item] = [];
      groups[item].push(task);
      return groups;
    }, {});
    const visualTitle = (title) => normalize(title).toLocaleUpperCase("pt-BR") === "PERMUTADOR AMOSTRA"
      ? "Permutador de Amostra"
      : title;
    const tasksForVisualGroup = (group) => group.items.flatMap((item) => {
      const itemTasks = byItem[item] || [];
      if (itemTasks.length <= 1) return itemTasks;
      const groupName = keyText(group.title);
      const matches = itemTasks.filter((task) => {
        const description = keyText(task.descricao);
        if (groupName.includes("tubulão")) return description.includes("tubulão");
        if (groupName.includes("superaquecedor")) return description.includes("superaquecedor");
        if (groupName === "bank") return description.includes("bank");
        if (groupName === "fornalha") return ["teto", "piso", "parede"].some((term) => description.includes(term));
        if (groupName === "pav") return description.includes("pav");
        return true;
      });
      return matches.length ? matches : itemTasks;
    });
    const renderGroup = (group, explicitTasks = null) => {
      const visibleTasks = explicitTasks || tasksForVisualGroup(group);
      if (!visibleTasks.length) return "";
      return `
      <section class="visual-group${visibleTasks.length === 1 ? " single-item" : ""}">
        <strong>${escapeHtml(visualTitle(group.title))}</strong>
        <div>
          ${visibleTasks.map((task) => {
            const itemState = visualTaskState(task);
            const item = normalize(task.item);
            const accessibleLabel = `Item ${item}: ${task.descricao}`;
            return `<button type="button" class="visual-item ${itemState}" data-open-id="${task.id}" title="${escapeHtml(accessibleLabel)}" aria-label="${escapeHtml(accessibleLabel)}">${escapeHtml(item)}</button>`;
          }).join("")}
        </div>
      </section>
    `; };
    const renderColumns = (columns, groups) => columns.map((titles) => `
      <div class="visual-column">
        ${titles.map((title) => {
          const group = groups.find((item) => item.title === title);
          return group ? renderGroup(group) : "";
        }).join("")}
      </div>
    `).join("");
    $("#visualMarkers").innerHTML = renderColumns(boilerColumns, visualGroups);

    const identifiedItems = new Set(visualGroups.flatMap((group) => group.items));
    const unmappedByEquipment = current.reduce((groups, task) => {
      if (identifiedItems.has(normalize(task.item))) return groups;
      const equipment = normalize(task.equipamento) || "Sem equipamento";
      if (!groups[equipment]) groups[equipment] = [];
      groups[equipment].push(task);
      return groups;
    }, {});
    const peripheralHtmlByTitle = Object.fromEntries(Object.entries(unmappedByEquipment).map(([title, equipmentTasks]) => [
      normalize(title).toLocaleUpperCase("pt-BR"),
      renderGroup(
        { title, items: [] },
        equipmentTasks.sort((a, b) => Number(a.item) - Number(b.item) || a.id - b.id)
      )
    ]));
    $("#visualUnmapped").innerHTML = [
      ["B-1251", "D-1207", "D-1247", "TB-1251"],
      ["MB-1251", "PERMUTADOR AMOSTRA", "RESFRIADOR", "V\u00c1LVULA"],
      ["E-1202", "INSTRUMENTA\u00c7\u00c3O", "TUBULA\u00c7\u00c3O"],
      ["SG-1205"]
    ].map((titles) => `<div class="visual-column">${titles.map((title) => peripheralHtmlByTitle[title] || "").join("")}</div>`).join("");
  }

  function renderCheckChart(current) {
    const labels = Object.fromEntries(progressFields);
    const counts = Object.fromEntries(progressFields.map(([field]) => [
      field,
      current.filter((task) => isPending(task[field])).length
    ]));
    const max = Math.max(...Object.values(counts), 1);

    const visibleGroups = controlGroups.map((group) => ({
      ...group,
      fields: group.fields.filter((field) => !numericControlFields.has(field) && counts[field] > 0)
    })).filter((group) => group.fields.length);

    $("#checkChart").innerHTML = visibleGroups.map((group) => `
      <section class="control-group control-group-${keyText(group.title)}">
        <header>
          <strong>${escapeHtml(group.title)}</strong>
          <span>${group.fields.reduce((sum, field) => sum + counts[field], 0)} pendências</span>
        </header>
        <div class="bar-chart">
          ${group.fields.map((field) => `
            <div class="bar-row">
              <span title="${escapeHtml(labels[field])}">${escapeHtml(labels[field])}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${(counts[field] / max) * 100}%"></div></div>
              <strong>${counts[field]}</strong>
            </div>`).join("")}
        </div>
      </section>`).join("");
  }

  function renderOwners(current) {
    const counts = countBy(current, "responsavel");
    const ownerOrder = new Map([["AMILTON", 0], ["EDILSON", 1], ["MINEIRO", 2]]);
    const top = Object.entries(counts).sort((a, b) => {
      const aOrder = ownerOrder.get(normalize(a[0]).toLocaleUpperCase("pt-BR")) ?? 99;
      const bOrder = ownerOrder.get(normalize(b[0]).toLocaleUpperCase("pt-BR")) ?? 99;
      return aOrder - bOrder || b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR");
    }).filter(([owner]) => normalize(owner).toLocaleUpperCase("pt-BR") !== "C&M");
    const ownerRows = top.map(([owner, count]) => {
      const initials = normalize(owner).split(" ").map((part) => part[0]).join("").slice(0, 2) || "SR";
      const pending = current.filter((task) => normalize(task.responsavel) === owner && taskMetrics(task).pending).length;
      const ownerKey = normalize(owner).toLocaleUpperCase("pt-BR");
      return { primary: ownerOrder.has(ownerKey), html: `<button class="owner-row owner-button" data-owner="${escapeHtml(owner)}">
        <span class="avatar">${escapeHtml(initials)}</span>
        <div><strong>${escapeHtml(owner === "-" ? "Sem responsável" : owner)}</strong><span>${pending} com pendência</span></div>
        <strong>${count}</strong>
      </button>` };
    });
    $("#ownerList").innerHTML = `
      <div class="owner-column">${ownerRows.filter((item) => item.primary).map((item) => item.html).join("")}</div>
      <div class="owner-column">${ownerRows.filter((item) => !item.primary).map((item) => item.html).join("")}</div>`;
  }

  function renderPriority(current) {
    const byOwner = current.reduce((groups, task) => {
      const pending = taskMetrics(task).pending;
      if (!pending) return groups;
      const owner = normalize(task.responsavel) || "Não informado";
      (groups[owner] ||= []).push({ task, pending });
      return groups;
    }, {});

    const groups = Object.entries(byOwner)
      .map(([owner, items]) => ({
        owner,
        isArea: false,
        items: items
          .sort((a, b) => b.pending - a.pending || String(a.task.item).localeCompare(String(b.task.item), "pt-BR"))
          .slice(0, 3),
        totalPending: items.reduce((sum, item) => sum + item.pending, 0)
      }))
      .sort((a, b) => b.totalPending - a.totalPending || a.owner.localeCompare(b.owner, "pt-BR"));

    const ieItems = current
      .filter((task) => normalize(task.cq) === "IE")
      .map((task) => ({ task, pending: taskMetrics(task).pending }))
      .filter((item) => item.pending > 0)
      .sort((a, b) => b.pending - a.pending || String(a.task.item).localeCompare(String(b.task.item), "pt-BR"))
      .slice(0, 3);
    if (ieItems.length) {
      groups.push({
        owner: "IE",
        isArea: true,
        items: ieItems,
        totalPending: ieItems.reduce((sum, item) => sum + item.pending, 0)
      });
    }

    $("#priorityTable").innerHTML = groups.length ? groups.map(({ owner, items, isArea }) => `
      <section class="priority-group">
        <header>
          <strong>${escapeHtml(owner)}${isArea ? ' <small>(Área)</small>' : ""}</strong>
          <span>${items.length} ${items.length === 1 ? "item prioritário" : "itens prioritários"}</span>
        </header>
        <div class="compact-table">
          ${items.map(({ task, pending }) => `
            <button class="compact-row row-button" data-open-id="${task.id}">
              <strong>${escapeHtml(task.equipamento)}</strong>
              <span>#${escapeHtml(task.item)}</span>
              <span class="pill ${taskStatus(taskMetrics(task), task).key}">${taskStatus(taskMetrics(task), task).label}</span>
            </button>`).join("")}
        </div>
      </section>`).join("") : '<div class="priority-empty">Nenhuma pendência registrada.</div>';
  }

  function renderEquipment(current) {
    const compositionOwners = new Set(["AMILTON", "EDILSON", "MINEIRO"]);
    const compositionTasks = current.filter((task) => compositionOwners.has(normalize(task.responsavel).toLocaleUpperCase("pt-BR")));
    const counts = Object.entries(countBy(compositionTasks, "equipamento")).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
    const max = Math.max(...counts.map((item) => item[1]), 1);
    $("#equipmentList").innerHTML = counts.map(([name, count]) => `
      <div class="equipment-row">
        <div class="equipment-label"><span>${escapeHtml(name)}</span><strong>${count}</strong></div>
        <div class="equipment-track"><span style="width:${(count / max) * 100}%"></span></div>
      </div>`).join("");
  }

  function renderAreaSummary(current) {
    const areas = Object.entries(countBy(current, "cq")).map(([area, count]) => {
      const areaTasks = current.filter((task) => (normalize(task.cq) || "Não informado") === area);
      const pendingTasks = areaTasks.filter((task) => taskMetrics(task).pending > 0).length;
      const pendingChecks = areaTasks.reduce((sum, task) => sum + taskMetrics(task).pending, 0);
      return { area, count, pendingTasks, pendingChecks };
    }).filter((item) => item.pendingTasks > 0)
      .sort((a, b) => b.pendingTasks - a.pendingTasks || b.pendingChecks - a.pendingChecks || a.area.localeCompare(b.area, "pt-BR"));

    $("#areaSummary").innerHTML = areas.map((item) => `
      <button class="area-summary-row" data-area="${escapeHtml(item.area)}">
        <strong>${escapeHtml(item.area)}</strong>
        <span>${item.count}</span>
        <span class="${item.pendingTasks ? "area-alert" : ""}">${item.pendingTasks}</span>
        <span class="${item.pendingChecks ? "area-alert" : ""}">${item.pendingChecks}</span>
        <span class="area-link">Detalhar →</span>
      </button>`).join("");
  }

  function countBy(list, field) {
    return list.reduce((acc, item) => {
      const value = normalize(item[field]) || "Não informado";
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  function renderTasks() {
    const filtered = getFilteredTasks();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * pageSize;
    const visible = filtered.slice(start, start + pageSize);

    $("#resultCount").textContent = filtered.length;
    $("#emptyState").hidden = visible.length !== 0;
    $("#taskRows").innerHTML = visible.map((task) => {
      const metrics = taskMetrics(task);
      const status = taskStatus(metrics, task);
      const executionValue = normalize(task.executante) || "Não informado";
      const executionStatus = keyText(executionValue) === "conc"
        ? "clear"
        : keyText(executionValue) === "canc"
          ? "canceled"
          : keyText(executionValue) === "and"
            ? "progress"
            : keyText(executionValue) === "pend"
              ? "pending"
              : "other";
      return `<article class="task-row">
        <div class="cell-primary"><strong>${escapeHtml(task.tag)}</strong><span>${escapeHtml(task.equipamento)}</span></div>
        <div class="cell-description"><strong>Item #${escapeHtml(task.item)}${photoTaskIds.has(task.id) ? '<span class="photo-badge">Foto</span>' : ""}</strong><span title="${escapeHtml(task.descricao)}">${escapeHtml(task.descricao)}</span></div>
        <div class="task-owner">${escapeHtml(normalize(task.responsavel) || "Não informado")}</div>
        <span class="pill ${executionStatus}">${escapeHtml(executionValue)}</span>
        <div class="check-count">${metrics.pending} pend. / ${metrics.applicable} ativos</div>
        <span class="pill ${status.key}">${status.label}</span>
        <button class="row-action" data-open-id="${task.id}" aria-label="Abrir tarefa">›</button>
      </article>`;
    }).join("");

    $("#pageInfo").textContent = filtered.length
      ? `${start + 1}-${Math.min(start + pageSize, filtered.length)} de ${filtered.length}`
      : "0 resultados";
    $("#prevPage").disabled = state.page <= 1;
    $("#nextPage").disabled = state.page >= totalPages;
  }

  function renderReport() {
    const labels = Object.fromEntries(checkFields);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const allEntries = loadReport();
    const entries = allEntries
      .filter((entry) => !state.reportDate || entry.at.slice(0, 10) === state.reportDate)
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    $("#navReportCount").textContent = allEntries.length;
    $("#reportRows").innerHTML = entries.map((entry) => {
      const task = taskById.get(entry.taskId) || {};
      const date = new Date(entry.at);
      const observation = reportObservation(entry);
      return `<article class="report-row">
        <strong>#${escapeHtml(task.item || entry.item || "")}</strong>
        <span>${escapeHtml(task.equipamento || entry.equipamento || "")}</span>
        <span>${escapeHtml(labels[entry.field] || entry.field)}</span>
        <span class="pill ${entry.status === "CANC" ? "canceled" : "clear"}">${escapeHtml(entry.status)}</span>
        <span>${escapeHtml(observation)}</span>
        <span>${date.toLocaleDateString("pt-BR")}</span>
        <span>${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        <strong>${escapeHtml(entry.user)}</strong>
      </article>`;
    }).join("");
    $("#printReportRows").innerHTML = entries.map((entry) => {
      const task = taskById.get(entry.taskId) || {};
      const date = new Date(entry.at);
      const observation = reportObservation(entry);
      return `<tr>
        <td>#${escapeHtml(task.item || entry.item || "")}</td>
        <td>${escapeHtml(task.equipamento || entry.equipamento || "")}</td>
        <td>${escapeHtml(entry.status)}</td>
        <td>${escapeHtml(entry.user)}</td>
        <td>${date.toLocaleDateString("pt-BR")}</td>
        <td>${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
        <td>${escapeHtml(observation)}</td>
      </tr>`;
    }).join("");
    $("#reportEmpty").hidden = entries.length !== 0;
  }

  function printReport() {
    if (!$("#reportRows").children.length) {
      showToast("Não há registros para imprimir.");
      return;
    }
    const printFrame = document.createElement("iframe");
    printFrame.setAttribute("title", "Impressão do Histórico de Avanço");
    printFrame.style.cssText = "position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none";
    document.body.append(printFrame);

    const logoUrl = new URL("assets/gcb-logo.svg", window.location.href).href;
    const tableHtml = $("#printReportTable").outerHTML;
    const printDocument = printFrame.contentDocument;
    printDocument.open();
    printDocument.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Histórico de Avanço</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            html, body {
              width: 210mm; margin: 0; padding: 0; color: #303a49;
              background: white; font-family: Arial, sans-serif;
              -webkit-text-size-adjust: 100%; text-size-adjust: 100%;
              print-color-adjust: exact; -webkit-print-color-adjust: exact;
            }
            main { width: 190mm; margin: 0 auto; }
            header {
              min-height: 15mm; margin: 0 0 5mm; display: flex;
              align-items: center; gap: 5mm; break-inside: avoid;
            }
            header img { width: 43mm; height: auto; max-height: 14mm; object-fit: contain; }
            header strong { color: #18212f; font-size: 16pt; }
            table {
              display: table; width: 190mm; border-collapse: collapse;
              table-layout: fixed; font-size: 7pt; line-height: 1.25;
            }
            thead { display: table-header-group; }
            tbody { display: table-row-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            th, td {
              padding: 1.5mm 1mm; border: .25mm solid #cfd5de;
              overflow-wrap: break-word; word-break: normal;
              text-align: center; vertical-align: middle;
            }
            th {
              background: #e9edf2; font-size: 6.5pt; line-height: 1.15;
              overflow-wrap: normal; text-transform: uppercase;
            }
            th:nth-child(1) { width: 14mm; }
            th:nth-child(2) { width: 28mm; }
            th:nth-child(3) { width: 24mm; }
            th:nth-child(4) { width: 31mm; }
            th:nth-child(5) { width: 18mm; }
            th:nth-child(6) { width: 17mm; }
          </style>
        </head>
        <body>
          <main>
            <header>
              <img src="${logoUrl}" alt="GCB Manutenção Industrial">
              <strong>Histórico de Avanço</strong>
            </header>
            ${tableHtml}
          </main>
        </body>
      </html>`);
    printDocument.close();

    const removeFrame = () => setTimeout(() => printFrame.remove(), 500);
    printFrame.contentWindow.addEventListener("afterprint", removeFrame, { once: true });
    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch {
        printFrame.remove();
        showToast("Não foi possível abrir a impressão do relatório.");
      }
    }, 350);
  }

  async function preparePrintMode(mode) {
    activePrintMode = mode;
    applyPrintMode();
    void document.body.offsetHeight;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.print();
  }

  function applyPrintMode() {
    const isReport = activePrintMode === "report";
    if (!printPageStyle) {
      printPageStyle = document.createElement("style");
      printPageStyle.id = "activePrintPageStyle";
      document.head.append(printPageStyle);
    }
    printPageStyle.textContent = isReport
      ? "@page { size: A4 portrait; margin: 10mm; }"
      : "@page { size: A3 landscape; margin: 5mm; }";
    document.documentElement.classList.toggle("print-visual", !isReport);
    document.documentElement.classList.toggle("print-report", isReport);
    document.body.classList.toggle("print-visual", !isReport);
    document.body.classList.toggle("print-report", isReport);
    $("#visualView").style.setProperty("display", isReport ? "none" : "grid", "important");
    $("#reportView").style.setProperty("display", isReport ? "block" : "none", "important");
  }

  function clearPrintMode() {
    activePrintMode = null;
    if (printPageStyle) {
      printPageStyle.remove();
      printPageStyle = null;
    }
    document.documentElement.classList.remove("print-report", "print-visual");
    document.body.classList.remove("print-report", "print-visual");
    $("#visualView").style.removeProperty("display");
    $("#reportView").style.removeProperty("display");
  }

  async function openTask(id) {
    const original = tasks.find((task) => task.id === id);
    if (!original) return;
    const task = mergedTask(original);
    state.currentId = id;
    $("#dialogTag").textContent = task.tag;
    $("#dialogTitle").textContent = `Item #${task.item}`;
    $("#dialogEquipment").textContent = task.equipamento;
    $("#dialogDocument").textContent = task.documento;
    $("#dialogOwner").value = normalize(task.responsavel);
    $("#dialogDescription").textContent = task.descricao;
    $("#dialogObservation").value = task.observacao || "";
    const executionOnly = canEditOnlyExecution();
    $("#dialogObservation").disabled = !currentUser || executionOnly;
    updateObservationCount();
    currentPhotos = [];
    renderPhotoGallery();
    const completionAudit = task.completionAudit || {};
    $("#dialogChecks").innerHTML = checkFields.map(([field, label]) => {
      const value = normalize(task[field]);
      const hasValidStatus = statusOptions.includes(value);
      const hasNumericValue = numericControlFields.has(field) && /^\d+(?:[.,]\d+)?$/.test(value);
      const options = [...new Set([
        ...(numericOptionsByField[field] || []),
        ...statusOptions
      ])];
      const audit = completionAudit[field];
      const statusClass = keyText(value) === "n.a"
        ? "status-na"
        : keyText(value) === "conc"
          ? "status-conc"
          : keyText(value) === "pend"
            ? "status-pend"
            : keyText(value) === "canc"
              ? "status-canc"
              : keyText(value) === "and"
                ? "status-and"
                : "";
      return `<div class="check-editor">
        <label for="check-${field}">${escapeHtml(label)}${audit ? `<small>Concluído por ${escapeHtml(audit.user)} em ${escapeHtml(formatAuditDate(audit.at))}</small>` : ""}</label>
        <select id="check-${field}" data-check-field="${field}" data-previous-value="${escapeHtml(value)}" class="${statusClass}" ${currentUser && !numericControlFields.has(field) && (!executionOnly || field === "executante") ? "" : "disabled"}>
          ${hasValidStatus || hasNumericValue ? "" : '<option value="" selected disabled hidden>Selecione</option>'}
          ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </div>`;
    }).join("");
    $("#saveTask").disabled = !currentUser;
    $("#resetTask").disabled = !currentUser || executionOnly;
    $(".photo-upload").classList.toggle("disabled", !currentUser);
    renderAuth();
    $("#editingIdentity").textContent = executionOnly
      ? `${currentUser}: alteração permitida somente em Executante`
      : currentUser
        ? `Alterações registradas por ${currentUser}`
        : "Entre para registrar alterações";
    $("#taskDialog").showModal();
    try {
      const photos = await getTaskPhotos(id);
      if (state.currentId === id) {
        currentPhotos = photos;
        renderPhotoGallery();
      }
    } catch {
      showToast("As fotos não estão disponíveis neste navegador.");
    }
  }

  async function getTaskPhotos(taskId) {
    if (onlineMode) return supabaseApi.getTaskPhotos(taskId);
    return fallbackPhotos.filter((photo) => photo.taskId === taskId).sort((a, b) => a.createdAt - b.createdAt);
  }

  async function loadPhotoTaskIds() {
    photoTaskIds = onlineMode
      ? await supabaseApi.loadPhotoTaskIds(remoteResetAt())
      : new Set(fallbackPhotos.map((photo) => photo.taskId));
  }

  async function putPhoto(photo) {
    if (onlineMode) return supabaseApi.uploadPhoto(photo, currentUser);
    fallbackPhotos.push(photo);
    return photo;
  }

  async function removePhoto(photoId) {
    if (onlineMode) return supabaseApi.removePhoto(photoId);
    fallbackPhotos = fallbackPhotos.filter((photo) => photo.id !== photoId);
  }

  async function removeTaskPhotos(taskId) {
    if (onlineMode) return supabaseApi.removeTaskPhotos(taskId);
    fallbackPhotos = fallbackPhotos.filter((photo) => photo.taskId !== taskId);
  }

  function renderPhotoGallery() {
    $("#photoGallery").innerHTML = currentPhotos.length
      ? currentPhotos.map((photo) => `<figure class="photo-card">
          <img src="${photo.dataUrl}" alt="${escapeHtml(photo.name || "Foto da tarefa")}">
          ${currentUser ? `<button class="photo-remove" type="button" data-remove-photo="${photo.id}" aria-label="Remover foto">×</button>` : ""}
        </figure>`).join("")
      : '<div class="photo-empty">Nenhuma foto adicionada.</div>';
    $("#taskPhotos").disabled = !currentUser || currentPhotos.length >= 4;
    $(".photo-upload").style.opacity = !currentUser || currentPhotos.length >= 4 ? ".5" : "1";
  }

  function hasCurrentTaskPhoto() {
    return currentPhotos.length > 0 || photoTaskIds.has(state.currentId);
  }

  function updateCheckStatusClass(select) {
    select.classList.toggle("status-na", keyText(select.value) === "n.a");
    select.classList.toggle("status-conc", keyText(select.value) === "conc");
    select.classList.toggle("status-pend", keyText(select.value) === "pend");
    select.classList.toggle("status-canc", keyText(select.value) === "canc");
    select.classList.toggle("status-and", keyText(select.value) === "and");
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("Imagem inválida"));
        image.onload = () => {
          const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", .78));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function addPhotos(files) {
    const available = 4 - currentPhotos.length;
    const selected = [...files].slice(0, available);
    if (!selected.length) {
      showToast("Esta tarefa já possui o limite de 4 fotos.");
      return;
    }
    try {
      for (const file of selected) {
        const photo = {
          id: `${state.currentId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          taskId: state.currentId,
          name: file.name,
          createdAt: Date.now(),
          dataUrl: await compressImage(file)
        };
        const storedPhoto = await putPhoto(photo);
        currentPhotos.push(storedPhoto);
      }
      photoTaskIds.add(state.currentId);
      renderPhotoGallery();
      renderTasks();
      showToast(`${selected.length} foto(s) adicionada(s).`);
    } catch {
      showToast("Não foi possível armazenar a imagem.");
    }
    $("#taskPhotos").value = "";
  }

  async function saveCurrentTask(event) {
    event.preventDefault();
    if (!currentUser) {
      openLogin();
      return;
    }
    const original = tasks.find((task) => task.id === state.currentId);
    if (!original) return;
    const previous = mergedTask(original);
    const executionOnly = canEditOnlyExecution();
    const hasNewCompletion = $$("[data-check-field]").some((select) => (
      !numericControlFields.has(select.dataset.checkField)
      && keyText(select.value) === "conc"
      && keyText(previous[select.dataset.checkField]) !== "conc"
    ));
    if (hasNewCompletion && !hasCurrentTaskPhoto()) {
      showToast("Adicione uma foto antes de concluir o item.");
      return;
    }
    const completionAudit = { ...(previous.completionAudit || {}) };
    const reportEntries = [];
    const update = {
      observacao: executionOnly ? (previous.observacao || "") : $("#dialogObservation").value.trim(),
      completionAudit
    };
    $$("[data-check-field]").forEach((select) => {
      const field = select.dataset.checkField;
      if (numericControlFields.has(field)) return;
      const nextValue = executionOnly && field !== "executante" ? previous[field] : select.value;
      const previousValue = previous[field];
      update[field] = nextValue || previousValue;
      if (!nextValue) return;
      if (keyText(nextValue) === "conc" && keyText(previousValue) !== "conc") {
        const at = new Date().toISOString();
        completionAudit[field] = { user: currentUser, at };
        reportEntries.push({
          taskId: original.id, item: original.item, equipamento: original.equipamento,
          field, status: "CONC", observation: field === "executante" ? "Aguardando CQ" : "",
          user: currentUser, at
        });
      } else if (keyText(nextValue) === "canc" && keyText(previousValue) !== "canc") {
        reportEntries.push({
          taskId: original.id, item: original.item, equipamento: original.equipamento,
          field, status: "CANC", observation: "", user: currentUser, at: new Date().toISOString()
        });
      } else if (keyText(nextValue) !== "conc" && keyText(previousValue) === "conc") {
        delete completionAudit[field];
      }
    });
    try {
      if (onlineMode) await supabaseApi.saveEdit(state.currentId, update, currentUser);
      await appendReportEntries(reportEntries);
      edits[state.currentId] = update;
      $("#taskDialog").close();
      refresh();
      showToast(onlineMode ? "Alterações salvas no Supabase." : "Alterações temporárias salvas nesta sessão.");
    } catch (error) {
      showToast(error.message || "Não foi possível salvar as alterações.");
    }
  }

  async function resetCurrentTask() {
    if (!currentUser) {
      openLogin();
      return;
    }
    if (canEditOnlyExecution()) {
      showToast("Seu acesso permite alterar somente o campo Executante.");
      return;
    }
    if (!state.currentId) return;
    try {
      if (onlineMode) await supabaseApi.deleteEdit(state.currentId);
      delete edits[state.currentId];
      await removeTaskPhotos(state.currentId);
      photoTaskIds.delete(state.currentId);
      $("#taskDialog").close();
      refresh();
      showToast("Tarefa restaurada para os dados originais.");
    } catch (error) {
      showToast(error.message || "Não foi possível restaurar a tarefa.");
    }
  }

  function exportCsv() {
    const rows = getFilteredTasks();
    const headers = ["TAG", "Equipamento", "Documento", "Item", "Descrição", "Observação", "CQ", "Produção", "BR", ...checkFields.map(([, label]) => label), "Responsável", "Histórico de conclusão"];
    const data = rows.map((task) => [
      task.tag, task.equipamento, task.documento, task.item, task.descricao, task.observacao || "", task.cq, task.producao, task.br,
      ...checkFields.map(([field]) => task[field]), task.responsavel, completionAuditText(task)
    ]);
    const csv = [headers, ...data].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cq-sg1205-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`${rows.length} tarefas exportadas.`);
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function completionAuditText(task) {
    const labels = Object.fromEntries(checkFields);
    return Object.entries(task.completionAudit || {}).map(([field, audit]) =>
      `${labels[field] || field}: ${audit.user} em ${formatAuditDate(audit.at)}`
    ).join(" | ");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function updateObservationCount() {
    $("#observationCount").textContent = $("#dialogObservation").value.length;
  }

  function formatAuditDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function setView(view) {
    state.view = view;
    $$(".view").forEach((element) => element.classList.toggle("active", element.id === `${view}View`));
    $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $("#pageTitle").textContent = view === "dashboard" ? "Visão geral" : view === "tasks" ? "Tarefas" : "Relatório";
    $("#pageEyebrow").textContent = "SG-1205";
    if (view === "visual") $("#pageTitle").textContent = "Acompanhamento Visual";
    if (view === "tasks") renderTasks();
    if (view === "report") renderReport();
    if (view === "visual") renderVisualMarkers();
  }

  function clearFilters() {
    state = { ...state, search: "", tag: "", equipment: "", area: "", owner: "", status: "", page: 1 };
    $("#globalSearch").value = "";
    $("#tagFilter").value = "";
    $("#equipmentFilter").value = "";
    $("#areaFilter").value = "";
    $("#ownerFilter").value = "";
    $("#statusFilter").value = "";
    renderTasks();
  }

  function refresh() {
    renderDashboard();
    renderTasks();
    renderReport();
    renderVisualMarkers();
  }

  function bindEvents() {
    $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    $("#globalSearch").addEventListener("input", (event) => {
      state.search = event.target.value;
      state.page = 1;
      if (state.view !== "tasks" && state.search) setView("tasks");
      else renderTasks();
    });
    [["#tagFilter", "tag"], ["#equipmentFilter", "equipment"], ["#areaFilter", "area"], ["#ownerFilter", "owner"], ["#statusFilter", "status"]]
      .forEach(([selector, field]) => $(selector).addEventListener("change", (event) => {
        state[field] = event.target.value;
        state.page = 1;
        renderTasks();
      }));
    $("#reportDateFilter").addEventListener("change", (event) => {
      state.reportDate = event.target.value;
      renderReport();
    });
    $("#clearFilters").addEventListener("click", clearFilters);
    $("#prevPage").addEventListener("click", () => { state.page--; renderTasks(); });
    $("#nextPage").addEventListener("click", () => { state.page++; renderTasks(); });
    $("#exportButton").addEventListener("click", exportCsv);
    $("#printVisualButton").addEventListener("click", () => preparePrintMode("visual"));
    $("#printReportButton").addEventListener("click", printReport);
    window.addEventListener("beforeprint", () => {
      if (activePrintMode) applyPrintMode();
    });
    window.addEventListener("afterprint", clearPrintMode);
    $("#loginButton").addEventListener("click", openLogin);
    $("#logoutButton").addEventListener("click", logout);
    $("#closeLogin").addEventListener("click", () => $("#loginDialog").close());
    $("#loginForm").addEventListener("submit", login);
    $("#registerButton").addEventListener("click", registerUser);
    $("#recoverPasswordButton").addEventListener("click", recoverPassword);
    $("#changePasswordForm").addEventListener("submit", changePassword);
    $("#changePasswordDialog").addEventListener("cancel", (event) => event.preventDefault());
    $("#saveTask").addEventListener("click", saveCurrentTask);
    $("#resetTask").addEventListener("click", resetCurrentTask);
    $("#taskPhotos").addEventListener("change", (event) => addPhotos(event.target.files));
    $("#dialogObservation").addEventListener("input", updateObservationCount);
    $("#dialogChecks").addEventListener("change", (event) => {
      const select = event.target.closest("[data-check-field]");
      if (select) {
        if (keyText(select.value) === "conc" && !hasCurrentTaskPhoto()) {
          select.value = select.dataset.previousValue || "PEND";
          updateCheckStatusClass(select);
          showToast("Adicione uma foto antes de selecionar CONC.");
          return;
        }
        select.dataset.previousValue = select.value;
        updateCheckStatusClass(select);
      }
    });
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-open-id]");
      if (trigger) openTask(Number(trigger.dataset.openId));
      const removeTrigger = event.target.closest("[data-remove-photo]");
      if (removeTrigger && currentUser) {
        const activeTask = tasks.find((task) => task.id === state.currentId);
        const task = activeTask ? mergedTask(activeTask) : null;
        if (canEditOnlyExecution() && currentPhotos.length === 1 && task && keyText(task.executante) === "conc") {
          showToast("A foto é obrigatória enquanto Executante estiver CONC.");
          return;
        }
        removePhoto(removeTrigger.dataset.removePhoto).then(async () => {
          currentPhotos = await getTaskPhotos(state.currentId);
          if (!currentPhotos.length) photoTaskIds.delete(state.currentId);
          renderPhotoGallery();
          renderTasks();
          showToast("Foto removida.");
        });
      }
      const goTasks = event.target.closest("[data-go-tasks]");
      if (goTasks) {
        state.status = goTasks.dataset.goTasks;
        $("#statusFilter").value = state.status;
        setView("tasks");
      }
      const areaTrigger = event.target.closest("[data-area]");
      if (areaTrigger) {
        state.area = areaTrigger.dataset.area === "Não informado" ? "" : areaTrigger.dataset.area;
        $("#areaFilter").value = state.area;
        state.page = 1;
        setView("tasks");
      }
      const ownerTrigger = event.target.closest("[data-owner]");
      if (ownerTrigger) {
        state.owner = ownerTrigger.dataset.owner;
        $("#ownerFilter").value = state.owner;
        state.page = 1;
        setView("tasks");
      }
      if (event.target.closest("[data-view-tasks]")) setView("tasks");
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("#globalSearch").focus();
      }
    });
  }

  function updateConnectionLabel() {
    const label = $(".sidebar-footer span:last-child");
    if (!label) return;
    if (onlineMode) label.textContent = "Conectado ao Supabase";
    else if (authAvailable) label.textContent = "Login Supabase / dados em fallback";
    else label.textContent = "Modo fallback: data.js";
  }

  async function syncRemoteState({ reloadItems = true } = {}) {
    if (!onlineMode) return;
    const [remoteItems, remoteEdits, remoteHistory, remotePhotoIds] = await Promise.all([
      reloadItems ? supabaseApi.loadItems() : Promise.resolve(tasks),
      supabaseApi.loadEdits(remoteResetAt()),
      supabaseApi.loadHistory(remoteResetAt()),
      supabaseApi.loadPhotoTaskIds(remoteResetAt())
    ]);
    if (remoteItems.length) {
      const remoteByIdentity = new Map(remoteItems.map((task) => [taskIdentity(task), task]));
      tasks = fallbackTasks.map((fallbackTask) => {
        const remoteTask = remoteByIdentity.get(taskIdentity(fallbackTask));
        return {
          ...fallbackTask,
          ...(remoteTask || {}),
          id: fallbackTask.id,
          executante: fallbackTask.executante
        };
      });
    }
    edits = remoteEdits;
    reportEntriesCache = remoteHistory;
    photoTaskIds = remotePhotoIds;
    rebuildNumericOptions();
    console.info("[SG-1205] Dados sincronizados com o Supabase.", {
      itens: tasks.length,
      alteracoes: Object.keys(edits).length,
      historico: reportEntriesCache.length,
      itensComFoto: photoTaskIds.size
    });
  }

  function scheduleRealtimeSync() {
    clearTimeout(realtimeTimer);
    realtimeTimer = setTimeout(async () => {
      try {
        await syncRemoteState();
        populateFilters();
        refresh();
        if (state.currentId && $("#taskDialog").open) {
          currentPhotos = await getTaskPhotos(state.currentId);
          renderPhotoGallery();
        }
      } catch {
        showToast("Não foi possível aplicar a atualização em tempo real.");
      }
    }, 250);
  }

  async function initializeData() {
    rebuildNumericOptions();
    if (!authAvailable) return;
    try {
      const session = await supabaseApi.getCurrentUser();
      currentUser = session?.username || null;
      mustChangePassword = Boolean(session?.mustChangePassword);
      supabaseApi.onAuthStateChange((event) => {
        if (event !== "PASSWORD_RECOVERY") return;
        mustChangePassword = true;
        $("#loginDialog").close();
        $("#changePasswordMessage").textContent = "Defina sua nova senha para recuperar o acesso.";
        $("#newPassword").value = "";
        $("#confirmPassword").value = "";
        $("#changePasswordDialog").showModal();
        $("#newPassword").focus();
      });
    } catch (error) {
      console.error("[SG-1205] Falha ao inicializar o Supabase Auth:", error);
    }
    try {
      onlineMode = true;
      await syncRemoteState();
      realtimeChannel = supabaseApi.subscribe(scheduleRealtimeSync);
    } catch (error) {
      console.error("[SG-1205] Entrada em modo fallback: falha ao sincronizar os dados do Supabase.", {
        mensagem: error?.message,
        codigo: error?.code,
        detalhes: error?.details,
        dica: error?.hint,
        erro: error
      });
      onlineMode = false;
      edits = {};
      reportEntriesCache = [];
      photoTaskIds = new Set();
      rebuildNumericOptions();
    }
  }

  async function init() {
    await initializeData();
    if (!tasks.length) {
      document.body.innerHTML = '<main style="padding:40px;font-family:Arial"><h1>Base de dados não encontrada</h1><p>Configure o Supabase ou verifique se data.js está disponível.</p></main>';
      return;
    }
    await loadPhotoTaskIds();
    populateFilters();
    bindEvents();
    renderAuth();
    updateConnectionLabel();
    refresh();
    if (currentUser && mustChangePassword) {
      $("#changePasswordMessage").textContent = "Altere a senha inicial para continuar.";
      $("#newPassword").value = "";
      $("#confirmPassword").value = "";
      $("#changePasswordDialog").showModal();
      $("#newPassword").focus();
    }
    setInterval(() => {
      if (state.view === "dashboard") renderDashboard();
      if (state.view === "visual") renderVisualMarkers();
    }, 2000);
    if (!onlineMode) {
      showToast(authAvailable
        ? "Login conectado ao Supabase; dados usando data.js como fallback."
        : supabaseApi.configurationError || "Preencha URL e ANON KEY em supabaseClient.js.");
    }
  }

  init().catch((error) => {
    document.body.innerHTML = `<main style="padding:40px;font-family:Arial"><h1>Não foi possível iniciar o SG-1205</h1><p>${escapeHtml(error.message || "Erro desconhecido")}</p></main>`;
  });
})();
