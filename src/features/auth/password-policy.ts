const commonPasswords = new Set([
  "password",
  "password123",
  "password1234",
  "password12345",
  "1234567890",
  "12345678910",
  "qwerty12345",
  "qwertyuiop",
  "letmein123",
  "iloveyou123",
  "abcdefghij",
  "1111111111",
  "0000000000",
  "admin12345",
  "welcome123",
]);

export function passwordPolicy(password: string, email = "") {
  const normalized = password.toLowerCase();
  const localPart = email.trim().toLowerCase().split("@")[0];
  const lengthMet = password.length >= 10;
  const distinct =
    !commonPasswords.has(normalized) &&
    !/^(.)(\1){9,}$/.test(password) &&
    !(localPart && localPart.length >= 3 && normalized.includes(localPart));
  const valid = lengthMet && distinct && password.length <= 128;
  return {
    lengthMet,
    distinct,
    valid,
    strength:
      password.length === 0
        ? ""
        : !valid
          ? "À renforcer"
          : password.length >= 14
            ? "Fort"
            : "Bien",
    score:
      password.length === 0 ? 0 : !valid ? 1 : password.length >= 14 ? 4 : 3,
  };
}
