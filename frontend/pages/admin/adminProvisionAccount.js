const form = document.getElementById("provisionForm");
const submitButton = form.querySelector('button[type="submit"]');
const roleSelect = document.getElementById("role");
const aidProviderField = document.getElementById("aidProviderField");
const aidProviderSelect = document.getElementById("aidProvider");
const aidProviderTeamField = document.getElementById("aidProviderTeamField");
const aidProviderTeamSelect = document.getElementById("aidProviderTeam");
const aidProviderNameField = document.getElementById("aidProviderNameField");
const aidProviderNameInput = document.getElementById("aidProviderName");
const aidProviderDescriptionField = document.getElementById(
  "aidProviderDescriptionField",
);
const aidProviderDescriptionInput = document.getElementById(
  "aidProviderDescription",
);
const aidProviderTeamNameField = document.getElementById(
  "aidProviderTeamNameField",
);
const aidProviderTeamNameInput = document.getElementById("aidProviderTeamName");
const aidProviderTeamDescriptionField = document.getElementById(
  "aidProviderTeamDescriptionField",
);
const aidProviderTeamDescriptionInput = document.getElementById(
  "aidProviderTeamDescription",
);
const firstNameInput = document.getElementById("firstName");
const lastNameInput = document.getElementById("lastName");
const firstNameField = firstNameInput.closest(".field");
const lastNameField = lastNameInput.closest(".field");
const emailInput = document.getElementById("email");
const emailField = document.getElementById("emailField");
const passwordInput = document.getElementById("password");
const passwordField = document.getElementById("passwordField");
let providersLoaded = false;

function formatDisplayName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])\w/g, (letter) => letter.toUpperCase());
}
const cancelConfirm = document.getElementById("cancelConfirm");
const cancelConfirmBackdrop = document.getElementById("cancelConfirmBackdrop");
const successDialog = document.getElementById("successDialog");
const successBackdrop = document.getElementById("successBackdrop");

function closeCancelConfirm() {
  cancelConfirm.close();
  cancelConfirmBackdrop.hidden = true;
}

cancelConfirm.addEventListener("close", () => {
  cancelConfirmBackdrop.hidden = true;
});

document.getElementById("cancelButton").addEventListener("click", (event) => {
  event.preventDefault();
  cancelConfirmBackdrop.hidden = false;
  cancelConfirm.showModal();
});

document
  .getElementById("keepEditing")
  .addEventListener("click", closeCancelConfirm);

document.getElementById("discardChanges").addEventListener("click", () => {
  window.location.href = "adminDashboard.html";
});

cancelConfirm.addEventListener("click", (event) => {
  const bounds = cancelConfirm.getBoundingClientRect();
  const clickedOutside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (clickedOutside) closeCancelConfirm();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cancelConfirm.open) closeCancelConfirm();
});

function closeSuccessDialog() {
  successDialog.close();
  successBackdrop.hidden = true;
}

successDialog.addEventListener("close", () => {
  successBackdrop.hidden = true;
});

document
  .getElementById("successDone")
  .addEventListener("click", closeSuccessDialog);

function setError(input, message) {
  const error = document.getElementById(`${input.id}Error`);
  input.classList.toggle("input-error", Boolean(message));
  error.textContent = message || "";
  return !message;
}

function validateInput(input) {
  if (!input.value.trim()) {
    const label = input.labels[0].textContent.replace("*", "").trim();
    return setError(input, `${label} is required.`);
  }

  if (input.id === "email" && !input.validity.valid) {
    return setError(
      input,
      "Enter an email in the format name@domain.extension.",
    );
  }

  if (input.id === "email" && !window.hasValidEmailExtension(input.value)) {
    return setError(
      input,
      "Enter an email with a valid extension, such as .com or .net.",
    );
  }

  if (input.id === "password" && input.value.length < 8) {
    return setError(input, "Password must be at least 8 characters.");
  }

  return setError(input, "");
}

const liveInputs = [
  document.getElementById("firstName"),
  document.getElementById("lastName"),
  emailInput,
  roleSelect,
  aidProviderSelect,
  aidProviderTeamSelect,
  aidProviderNameInput,
  aidProviderDescriptionInput,
  aidProviderTeamNameInput,
  aidProviderTeamDescriptionInput,
  passwordInput,
];

liveInputs.forEach((input) => {
  input.addEventListener("blur", () => validateInput(input));
  input.addEventListener("input", () => validateInput(input));
  input.addEventListener("change", () => validateInput(input));
});

async function loadAidProviders() {
  aidProviderSelect.replaceChildren(new Option("Loading aid providers...", ""));
  aidProviderSelect.disabled = true;

  try {
    const response = await fetch("/api/aidProviders");
    if (!response.ok) throw new Error("Unable to load aid providers.");

    const providers = await response.json();
    aidProviderSelect.replaceChildren(new Option("Select aid provider", ""));

    providers.forEach((provider) => {
      aidProviderSelect.add(
        new Option(formatDisplayName(provider.name), provider.id),
      );
    });

    providersLoaded = true;
    aidProviderSelect.disabled = providers.length === 0;

    if (!providers.length) {
      aidProviderSelect.replaceChildren(
        new Option("No active aid providers found", ""),
      );
    }
  } catch (error) {
    console.error(error);
    aidProviderSelect.replaceChildren(
      new Option("Unable to load aid providers", ""),
    );
    aidProviderSelect.disabled = true;
  }
}

async function loadAidProviderTeams(providerId) {
  aidProviderTeamSelect.replaceChildren(new Option("Loading teams...", ""));
  aidProviderTeamSelect.disabled = true;

  try {
    const response = await fetch(`/api/aidProviders/${providerId}/teams`);
    if (!response.ok) throw new Error("Unable to load aid provider teams.");

    const teams = await response.json();
    aidProviderTeamSelect.replaceChildren(new Option("Select team", ""));
    teams.forEach((team) => {
      aidProviderTeamSelect.add(new Option(team.name, team.id));
    });
    aidProviderTeamSelect.disabled = teams.length === 0;

    if (!teams.length) {
      aidProviderTeamSelect.replaceChildren(
        new Option("No active teams found", ""),
      );
    }
  } catch (error) {
    console.error(error);
    aidProviderTeamSelect.replaceChildren(
      new Option("Unable to load teams", ""),
    );
    aidProviderTeamSelect.disabled = true;
  }
}

function updateAidProviderField() {
  const needsProvider = [
    "AID_PROVIDER_TEAM",
    "AID_PROVIDER_TEAM_MEMBER",
  ].includes(roleSelect.value);
  const needsTeam = roleSelect.value === "AID_PROVIDER_TEAM_MEMBER";
  const needsProviderName = roleSelect.value === "AID_PROVIDER";
  const needsProviderTeamName = roleSelect.value === "AID_PROVIDER_TEAM";
  const needsPersonName = !needsProviderName && !needsProviderTeamName;
  const needsUserCredentials = needsPersonName;
  aidProviderField.hidden = !needsProvider;
  aidProviderSelect.required = needsProvider;
  aidProviderTeamField.hidden = !needsTeam;
  aidProviderTeamSelect.required = needsTeam;
  aidProviderNameField.hidden = !needsProviderName;
  aidProviderNameInput.required = needsProviderName;
  aidProviderDescriptionField.hidden = !needsProviderName;
  aidProviderDescriptionInput.required = needsProviderName;
  aidProviderTeamNameField.hidden = !needsProviderTeamName;
  aidProviderTeamNameInput.required = needsProviderTeamName;
  aidProviderTeamDescriptionField.hidden = !needsProviderTeamName;
  aidProviderTeamDescriptionInput.required = needsProviderTeamName;
  firstNameInput.required = needsPersonName;
  lastNameInput.required = needsPersonName;
  firstNameField.hidden = !needsPersonName;
  lastNameField.hidden = !needsPersonName;
  emailField.hidden = !needsUserCredentials;
  emailInput.required = needsUserCredentials;
  passwordField.hidden = !needsUserCredentials;
  passwordInput.required = needsUserCredentials;

  if (needsProvider && !providersLoaded) {
    loadAidProviders().catch((error) => console.error(error));
  }

  if (needsTeam && aidProviderSelect.value) {
    loadAidProviderTeams(aidProviderSelect.value).catch((error) =>
      console.error(error),
    );
  }

  if (!needsProvider) {
    aidProviderSelect.value = "";
  }

  if (!needsProviderName) {
    aidProviderNameInput.value = "";
    aidProviderDescriptionInput.value = "";
  }

  if (!needsProviderTeamName) {
    aidProviderTeamNameInput.value = "";
    aidProviderTeamDescriptionInput.value = "";
  }

  if (!needsTeam) {
    aidProviderTeamSelect.value = "";
    aidProviderTeamSelect.replaceChildren(new Option("Select team", ""));
    aidProviderTeamSelect.disabled = true;
  }
}

function getProvisioningRoles() {
  const teamMemberRole = roleSelect.value === "AID_PROVIDER_TEAM_MEMBER";
  const providerAccountRole = roleSelect.value === "AID_PROVIDER";
  const providerTeamRole = roleSelect.value === "AID_PROVIDER_TEAM";

  return {
    providerRole: teamMemberRole || providerTeamRole,
    teamMemberRole,
    providerAccountRole,
    providerTeamRole,
    personNameRole: !providerAccountRole && !providerTeamRole,
  };
}

function validateProvisionForm(roles) {
  let isValid = true;
  const inputsToValidate = liveInputs.filter(
    (input) =>
      (input !== aidProviderSelect || roles.providerRole) &&
      (input !== aidProviderTeamSelect || roles.teamMemberRole) &&
      (input !== aidProviderNameInput || roles.providerAccountRole) &&
      (input !== aidProviderDescriptionInput || roles.providerAccountRole) &&
      (input !== aidProviderTeamNameInput || roles.providerTeamRole) &&
      (input !== aidProviderTeamDescriptionInput || roles.providerTeamRole) &&
      (input !== emailInput || roles.personNameRole) &&
      (input !== passwordInput || roles.personNameRole) &&
      ((input.id !== "firstName" && input.id !== "lastName") ||
        roles.personNameRole),
  );

  inputsToValidate.forEach((input) => {
    if (!validateInput(input)) {
      isValid = false;
    }
  });

  return isValid;
}

function buildProvisioningRequest(data, role, roles) {
  if (roles.providerAccountRole) {
    return {
      endpoint: "/api/aidProviders",
      payload: {
        name: data.get("aidProviderName").trim(),
        description: data.get("aidProviderDescription").trim(),
      },
    };
  }

  if (roles.providerTeamRole) {
    return {
      endpoint: "/api/aidProviders/teams",
      payload: {
        aid_provider_id: data.get("aidProvider"),
        name: data.get("aidProviderTeamName").trim(),
        description: data.get("aidProviderTeamDescription").trim(),
      },
    };
  }

  if (roles.teamMemberRole) {
    return {
      endpoint: "/api/aidProviders/teamMembers",
      payload: {
        first_name: data.get("firstName").trim().toLowerCase(),
        last_name: data.get("lastName").trim().toLowerCase(),
        email: data.get("email").trim().toLowerCase(),
        password: data.get("password"),
        aid_provider_id: data.get("aidProvider"),
        aid_provider_team_id: data.get("aidProviderTeam"),
      },
    };
  }

  return {
    endpoint: "/api/users/createUser",
    payload: {
      first_name: data.get("firstName").trim().toLowerCase(),
      last_name: data.get("lastName").trim().toLowerCase(),
      email: data.get("email").trim().toLowerCase(),
      password: data.get("password"),
      role,
    },
  };
}

async function getProvisioningErrorMessage(response) {
  let error = {};

  try {
    error = await response.json();
  } catch (parseError) {
    console.error(parseError);
  }

  if (Array.isArray(error.detail)) {
    return error.detail.map((item) => item.msg).join(" ");
  }

  if (error.detail) {
    return error.detail;
  }

  return "Unable to provision this account.";
}

function getProvisioningSuccessMessage(data, roles) {
  if (roles.providerAccountRole) {
    const displayName = formatDisplayName(data.get("aidProviderName"));
    return `Aid provider ${displayName} was created successfully.`;
  }

  if (roles.providerTeamRole) {
    const displayName = formatDisplayName(data.get("aidProviderTeamName"));
    return `Aid provider team ${displayName} was created successfully.`;
  }

  const displayName =
    `${formatDisplayName(data.get("firstName"))} ${formatDisplayName(data.get("lastName"))}`.trim();
  return `User ${displayName} was created successfully.`;
}

roleSelect.addEventListener("change", updateAidProviderField);
aidProviderSelect.addEventListener("change", () => {
  aidProviderTeamSelect.value = "";
  if (
    roleSelect.value === "AID_PROVIDER_TEAM_MEMBER" &&
    aidProviderSelect.value
  ) {
    loadAidProviderTeams(aidProviderSelect.value).catch((error) =>
      console.error(error),
    );
  }
});
updateAidProviderField();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const roles = getProvisioningRoles();
  if (!validateProvisionForm(roles)) return;

  const data = new FormData(form);
  const role = data.get("role");

  submitButton.disabled = true;
  submitButton.textContent = "Provisioning...";

  const { endpoint, payload } = buildProvisioningRequest(data, role, roles);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await getProvisioningErrorMessage(response));
    }

    await response.json();

    document.getElementById("successMessage").textContent =
      getProvisioningSuccessMessage(data, roles);
    form.reset();
    updateAidProviderField();
    successBackdrop.hidden = false;
    successDialog.showModal();
  } catch (error) {
    const isDuplicateProviderName =
      roles.providerAccountRole &&
      error.message.toLowerCase().includes("aid provider with that name");
    const isDuplicateTeamName =
      roles.providerTeamRole &&
      error.message.toLowerCase().includes("aid provider team with that name");
    let errorInput = document.getElementById("email");
    if (isDuplicateProviderName) {
      errorInput = aidProviderNameInput;
    } else if (isDuplicateTeamName) {
      errorInput = aidProviderTeamNameInput;
    } else if (roles.providerRole) {
      errorInput = aidProviderSelect;
    }
    setError(errorInput, error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Provide application access";
  }
});
