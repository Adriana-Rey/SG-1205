(() => {
  "use strict";

  const tasks = window.SG1205_DATA || [];
  const metadata = window.SG1205_META || {};
  const storageKey = "cq-control-sg1205-edits-v2";
  const photoDbName = "cq-control-sg1205-photos-v2";
  const usersKey = "cq-control-sg1205-users-v1";
  const sessionKey = "cq-control-sg1205-session-v1";
  const reportKey = "cq-control-sg1205-report-v1";
  const defaultUsers = ["Amilton", "Edilson", "Mineiro", "Elias", "Eron", "Maciel", "Brazil", "Amaro", "Anderson", "Adriana", "Johni"];
  const defaultPassword = "senha1234";
  const pageSize = 12;
  const checkFields = [
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
  const statusOptions = ["CONC", "PEND", "N.A", "CANC"];
  const numericControlFields = new Set(["petp", "ieis", "planoTorque"]);
  const progressFields = checkFields.filter(([field]) => !numericControlFields.has(field));
  const primaryOwners = new Set(["AMILTON", "EDILSON", "MINEIRO"]);
  const numericOptionsByField = Object.fromEntries([...numericControlFields].map((field) => [
    field,
    [...new Set(tasks.map((task) => String(task[field] ?? "").trim()).filter((value) => /^\d+(?:[.,]\d+)?$/.test(value)))]
      .sort((a, b) => Number(a.replace(",", ".")) - Number(b.replace(",", ".")))
  ]));
  const controlGroups = [
    {
      title: "Integridade",
      fields: ["visual", "replicaMetalografica", "lpResp", "pmResp", "meResp", "cpResp", "irisResp", "usResp"]
    },
    {
      title: "Qualidade",
      fields: ["evsResp", "ieis", "lpQualidade", "pmQualidade", "usQualidade", "rx", "ttat", "dureza", "planoTorque", "relatorioTorque", "petp", "th", "isolamentoRefratario", "registroFotografico", "lv"]
    },
    {
      title: "Produção",
      fields: ["producao"]
    }
  ];

  let edits = loadEdits();
  let currentUser = loadSession();
  let photoTaskIds = new Set();
  let currentPhotos = [];
  let state = { view: "dashboard", search: "", tag: "", equipment: "", area: "", owner: "", status: "", reportDate: "", page: 1, currentId: null };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
  const keyText = (value) => normalize(value).toLocaleLowerCase("pt-BR");
  const isPending = (value) => keyText(value) === "pend";
  const isApplicable = (value) => value !== null && value !== "" && !["n.a", "-", "canc"].includes(keyText(value));

  function loadEdits() {
    try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
    catch { return {}; }
  }

  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(usersKey)) || {}; }
    catch { return {}; }
  }

  function loadSession() {
    const username = sessionStorage.getItem(sessionKey);
    if (!username) return null;
    return loadUsers()[String(username).trim().toLocaleLowerCase("pt-BR")]?.username || null;
  }

  function loadReport() {
    try { return JSON.parse(localStorage.getItem(reportKey)) || []; }
    catch { return []; }
  }

  function appendReportEntries(entries) {
    if (!entries.length) return;
    localStorage.setItem(reportKey, JSON.stringify([...loadReport(), ...entries].slice(-5000)));
  }

  async function hashPassword(password) {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function seedDefaultUsers() {
    const users = loadUsers();
    const passwordHash = await hashPassword(defaultPassword);
    let changed = false;
    defaultUsers.forEach((username) => {
      const key = keyText(username);
      if (!users[key]) {
        users[key] = {
          username,
          passwordHash,
          mustChangePassword: true,
          createdAt: new Date().toISOString()
        };
        changed = true;
      }
    });
    if (changed) localStorage.setItem(usersKey, JSON.stringify(users));
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
    if (username.length < 3 || password.length < 4) {
      $("#loginMessage").textContent = "Informe usuário com 3 caracteres e senha com pelo menos 4.";
      return;
    }
    const users = loadUsers();
    const key = keyText(username);
    if (users[key]) {
      $("#loginMessage").textContent = "Este usuário já está cadastrado.";
      return;
    }
    users[key] = { username, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() };
    localStorage.setItem(usersKey, JSON.stringify(users));
    currentUser = username;
    sessionStorage.setItem(sessionKey, username);
    $("#loginDialog").close();
    renderAuth();
    showToast(`Usuário ${username} cadastrado e conectado.`);
  }

  async function login(event) {
    event.preventDefault();
    const username = normalize($("#loginUsername").value);
    const password = $("#loginPassword").value;
    const user = loadUsers()[keyText(username)];
    if (!user || user.passwordHash !== await hashPassword(password)) {
      $("#loginMessage").textContent = "Usuário ou senha inválidos.";
      return;
    }
    currentUser = user.username;
    $("#loginDialog").close();
    if (user.mustChangePassword) {
      $("#changePasswordMessage").textContent = "";
      $("#newPassword").value = "";
      $("#confirmPassword").value = "";
      $("#changePasswordDialog").showModal();
      $("#newPassword").focus();
    } else {
      sessionStorage.setItem(sessionKey, currentUser);
      renderAuth();
      showToast(`Conectado como ${currentUser}.`);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    const password = $("#newPassword").value;
    const confirmation = $("#confirmPassword").value;
    if (password.length < 4) {
      $("#changePasswordMessage").textContent = "A nova senha deve ter pelo menos 4 caracteres.";
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
    const users = loadUsers();
    const key = keyText(currentUser);
    if (!users[key]) return;
    users[key].passwordHash = await hashPassword(password);
    users[key].mustChangePassword = false;
    users[key].passwordChangedAt = new Date().toISOString();
    localStorage.setItem(usersKey, JSON.stringify(users));
    sessionStorage.setItem(sessionKey, currentUser);
    $("#changePasswordDialog").close();
    renderAuth();
    showToast("Senha alterada. Acesso liberado.");
  }

  function logout() {
    currentUser = null;
    sessionStorage.removeItem(sessionKey);
    renderAuth();
    showToast("Sessão encerrada.");
  }

  function mergedTask(task) {
    const localEdit = { ...(edits[task.id] || {}) };
    delete localEdit.responsavel;
    numericControlFields.forEach((field) => delete localEdit[field]);
    return { ...task, ...localEdit };
  }

  function taskMetrics(task) {
    const values = progressFields.map(([field]) => task[field]);
    const pending = values.filter(isPending).length;
    const completed = values.filter((value) => keyText(value) === "conc").length;
    const canceled = values.filter((value) => keyText(value) === "canc").length;
    const applicable = values.filter(isApplicable).length;
    return { pending, completed, canceled, applicable };
  }

  function taskStatus(metrics, task) {
    if (task && !primaryOwners.has(normalize(task.responsavel).toLocaleUpperCase("pt-BR"))) {
      return { key: "other", label: "Outros" };
    }
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
    const otherTasks = current.filter((task) =>
      !primaryOwners.has(normalize(task.responsavel).toLocaleUpperCase("pt-BR"))
    ).length;
    const pendingChecks = metrics.reduce((sum, item) => sum + item.pending, 0);
    const completedChecks = metrics.reduce((sum, item) => sum + item.completed, 0);
    const canceledChecks = progressTasks.reduce((sum, task) =>
      sum + progressFields.filter(([field]) => keyText(task[field]) === "canc").length, 0);
    const totalActive = pendingChecks + completedChecks;
    const progress = totalActive ? Math.round((completedChecks / totalActive) * 100) : 0;
    const pendingDegrees = totalActive ? (pendingChecks / totalActive) * 360 : 0;
    const completedDegrees = totalActive ? (completedChecks / totalActive) * 360 : 0;
    $("#totalTasks").textContent = current.length;
    $("#navTaskCount").textContent = current.length;
    $("#totalTags").textContent = `${unique("tag").length} TAGs mapeadas`;
    $("#pendingTasks").textContent = pendingTasks;
    $("#pendingRate").textContent = `${Math.round((pendingTasks / current.length) * 100)}% da base`;
    $("#clearTasks").textContent = clearTasks;
    $("#canceledTasks").textContent = canceledTasks;
    $("#otherTasks").textContent = otherTasks;
    $("#progressPercent").textContent = `${progress}%`;
    $("#progressPending").textContent = pendingChecks;
    $("#progressCompleted").textContent = completedChecks;
    $("#progressCanceled").textContent = canceledChecks;
    $("#progressRing").style.setProperty("--pending-end", `${pendingDegrees}deg`);
    $("#progressRing").style.setProperty("--completed-end", `${pendingDegrees + completedDegrees}deg`);

    renderCheckChart(progressTasks);
    renderOwners(current);
    renderEquipment(current);
    renderAreaSummary(current);
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
      <section class="control-group">
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
      return `<article class="task-row">
        <div class="cell-primary"><strong>${escapeHtml(task.tag)}</strong><span>${escapeHtml(task.equipamento)}</span></div>
        <div class="cell-description"><strong>Item #${escapeHtml(task.item)}${photoTaskIds.has(task.id) ? '<span class="photo-badge">Foto</span>' : ""}</strong><span title="${escapeHtml(task.descricao)}">${escapeHtml(task.descricao)}</span></div>
        <div class="task-owner">${escapeHtml(normalize(task.responsavel) || "Não informado")}</div>
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
      return `<article class="report-row">
        <strong>#${escapeHtml(task.item || entry.item || "")}</strong>
        <span>${escapeHtml(task.equipamento || entry.equipamento || "")}</span>
        <span>${escapeHtml(labels[entry.field] || entry.field)}</span>
        <span class="pill ${entry.status === "CANC" ? "canceled" : "clear"}">${escapeHtml(entry.status)}</span>
        <span>${date.toLocaleDateString("pt-BR")}</span>
        <span>${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        <strong>${escapeHtml(entry.user)}</strong>
      </article>`;
    }).join("");
    $("#reportEmpty").hidden = entries.length !== 0;
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
    $("#dialogObservation").disabled = !currentUser;
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
              : "";
      return `<div class="check-editor">
        <label for="check-${field}">${escapeHtml(label)}${audit ? `<small>Concluído por ${escapeHtml(audit.user)} em ${escapeHtml(formatAuditDate(audit.at))}</small>` : ""}</label>
        <select id="check-${field}" data-check-field="${field}" data-previous-value="${escapeHtml(value)}" class="${statusClass}" ${currentUser && !numericControlFields.has(field) ? "" : "disabled"}>
          ${hasValidStatus || hasNumericValue ? "" : '<option value="" selected disabled hidden>Selecione</option>'}
          ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </div>`;
    }).join("");
    $("#saveTask").disabled = !currentUser;
    $("#resetTask").disabled = !currentUser;
    $(".photo-upload").classList.toggle("disabled", !currentUser);
    renderAuth();
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

  function openPhotoDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(photoDbName, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("photos", { keyPath: "id" });
        store.createIndex("taskId", "taskId");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getTaskPhotos(taskId) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction("photos").objectStore("photos").index("taskId").getAll(taskId);
      request.onsuccess = () => resolve(request.result.sort((a, b) => a.createdAt - b.createdAt));
      request.onerror = () => reject(request.error);
    });
  }

  async function loadPhotoTaskIds() {
    const db = await openPhotoDb();
    const records = await new Promise((resolve, reject) => {
      const request = db.transaction("photos").objectStore("photos").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    photoTaskIds = new Set(records.map((photo) => photo.taskId));
  }

  async function putPhoto(photo) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction("photos", "readwrite").objectStore("photos").put(photo);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function removePhoto(photoId) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction("photos", "readwrite").objectStore("photos").delete(photoId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function removeTaskPhotos(taskId) {
    const photos = await getTaskPhotos(taskId);
    await Promise.all(photos.map((photo) => removePhoto(photo.id)));
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
        await putPhoto(photo);
        currentPhotos.push(photo);
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

  function saveCurrentTask(event) {
    event.preventDefault();
    if (!currentUser) {
      openLogin();
      return;
    }
    const original = tasks.find((task) => task.id === state.currentId);
    if (!original) return;
    const previous = mergedTask(original);
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
      observacao: $("#dialogObservation").value.trim(),
      completionAudit
    };
    $$("[data-check-field]").forEach((select) => {
      const field = select.dataset.checkField;
      if (numericControlFields.has(field)) return;
      const nextValue = select.value;
      const previousValue = previous[field];
      update[field] = nextValue || previousValue;
      if (!nextValue) return;
      if (keyText(nextValue) === "conc" && keyText(previousValue) !== "conc") {
        const at = new Date().toISOString();
        completionAudit[field] = { user: currentUser, at };
        reportEntries.push({
          taskId: original.id, item: original.item, equipamento: original.equipamento,
          field, status: "CONC", user: currentUser, at
        });
      } else if (keyText(nextValue) === "canc" && keyText(previousValue) !== "canc") {
        reportEntries.push({
          taskId: original.id, item: original.item, equipamento: original.equipamento,
          field, status: "CANC", user: currentUser, at: new Date().toISOString()
        });
      } else if (keyText(nextValue) !== "conc" && keyText(previousValue) === "conc") {
        delete completionAudit[field];
      }
    });
    appendReportEntries(reportEntries);
    edits[state.currentId] = update;
    localStorage.setItem(storageKey, JSON.stringify(edits));
    $("#taskDialog").close();
    refresh();
    showToast("Alterações salvas com sucesso.");
  }

  async function resetCurrentTask() {
    if (!currentUser) {
      openLogin();
      return;
    }
    if (!state.currentId) return;
    delete edits[state.currentId];
    localStorage.setItem(storageKey, JSON.stringify(edits));
    await removeTaskPhotos(state.currentId);
    photoTaskIds.delete(state.currentId);
    $("#taskDialog").close();
    refresh();
    showToast("Tarefa restaurada para os dados originais.");
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
    if (view === "tasks") renderTasks();
    if (view === "report") renderReport();
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
    $("#loginButton").addEventListener("click", openLogin);
    $("#logoutButton").addEventListener("click", logout);
    $("#closeLogin").addEventListener("click", () => $("#loginDialog").close());
    $("#loginForm").addEventListener("submit", login);
    $("#registerButton").addEventListener("click", registerUser);
    $("#changePasswordForm").addEventListener("submit", changePassword);
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

  if (!tasks.length) {
    document.body.innerHTML = '<main style="padding:40px;font-family:Arial"><h1>Base de dados não encontrada</h1><p>Verifique se o arquivo data.js está na mesma pasta do aplicativo.</p></main>';
    return;
  }

  async function init() {
    await seedDefaultUsers();
    currentUser = loadSession();
    await loadPhotoTaskIds();
    populateFilters();
    bindEvents();
    renderAuth();
    refresh();
    setInterval(() => {
      if (state.view === "dashboard") renderDashboard();
    }, 2000);
  }

  init().catch(() => {
    seedDefaultUsers().finally(() => {
      currentUser = loadSession();
      populateFilters();
      bindEvents();
      renderAuth();
      refresh();
      setInterval(() => {
        if (state.view === "dashboard") renderDashboard();
      }, 2000);
      showToast("O armazenamento de fotos não está disponível neste navegador.");
    });
  });
})();
