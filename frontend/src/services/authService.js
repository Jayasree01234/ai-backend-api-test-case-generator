const USERS_KEY = "api_test_ai_users";
const SESSION_KEY = "api_test_ai_session";

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toBase64(bytes) {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure password hashing is unavailable in this browser.");
  }

  const saltBytes = Uint8Array.from(atob(salt), (char) =>
    char.charCodeAt(0)
  );

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const result = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256
  );

  return toBase64(new Uint8Array(result));
}

function publicUser(account) {
  return {
    id: account.id,
    email: account.email,
    user_metadata: { name: account.name },
  };
}

export async function registerUser(name, email, password) {
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanName || !cleanEmail) {
    throw new Error("Name and email are required.");
  }

  if (String(password || "").length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const users = readUsers();

  if (users.some((user) => user.email === cleanEmail)) {
    throw new Error("An account with this email already exists in this browser.");
  }

  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashPassword(password, salt);

  const account = {
    id: createId(),
    name: cleanName,
    email: cleanEmail,
    salt,
    passwordHash,
    created_at: new Date().toISOString(),
  };

  localStorage.setItem(USERS_KEY, JSON.stringify([...users, account]));

  return { user: publicUser(account) };
}

export async function loginUser(email, password) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const account = readUsers().find((user) => user.email === cleanEmail);

  if (!account) {
    throw new Error("No local account found. Please create an account first.");
  }

  const enteredHash = await hashPassword(password, account.salt);

  if (enteredHash !== account.passwordHash) {
    throw new Error("Incorrect email or password.");
  }

  const user = publicUser(account);
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));

  return { user };
}

export async function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}

export async function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}