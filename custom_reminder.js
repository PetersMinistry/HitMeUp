const subjectElement = document.getElementById("subject");
const remindAtElement = document.getElementById("remind-at");
const messageElement = document.getElementById("message");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const titleElement = document.querySelector("h2");
const taglineElement = document.querySelector(".tagline");

function toDateTimeLocalValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

browser.storage.local.get("pendingCustomReminder").then((stored) => {
  const pendingReminder = stored.pendingCustomReminder;
  const existingTime = pendingReminder && Number(pendingReminder.existingRemindAt);

  subjectElement.textContent = pendingReminder
    ? pendingReminder.subject || "(No subject)"
    : "No email selected.";

  if (Number.isFinite(existingTime)) {
    titleElement.textContent = "Edit Reminder Time";
    taglineElement.textContent = "Adjust when this message should come back.";
    saveButton.textContent = "Update Reminder";
    remindAtElement.value = toDateTimeLocalValue(
      new Date(existingTime > Date.now() ? existingTime : Date.now() + 60 * 60 * 1000)
    );
  }
});

remindAtElement.min = toDateTimeLocalValue(new Date(Date.now() + 60 * 1000));
remindAtElement.value = remindAtElement.value || toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));

saveButton.addEventListener("click", () => {
  const selectedTime = new Date(remindAtElement.value).getTime();

  if (!Number.isFinite(selectedTime) || selectedTime <= Date.now()) {
    messageElement.textContent = "Pick a future date and time.";
    return;
  }

  browser.runtime.sendMessage({
    type: "create-custom-reminder",
    remindAt: selectedTime
  }).then(() => {
    window.close();
  });
});

cancelButton.addEventListener("click", () => {
  browser.storage.local.remove("pendingCustomReminder").then(() => {
    window.close();
  });
});
