(function () {
  var themes = ["deep-night", "blue-dusk", "golden-sunset"];
  var selectedTheme = themes[Math.floor(Math.random() * themes.length)];
  document.body.classList.add(selectedTheme);

  var welcomeText = document.getElementById("welcomeText");
  var dateText = document.getElementById("dateText");
  var timeText = document.getElementById("timeText");

  function getGreeting(hour) {
    if (hour < 12) {
      return "早上好，欢迎来到可乐的主页";
    }

    if (hour < 18) {
      return "下午好，欢迎来到可乐的主页";
    }

    return "晚上好，欢迎来到可乐的主页";
  }

  function updateClock() {
    var now = new Date();
    var dateFormatter = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long"
    });
    var timeFormatter = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

    welcomeText.textContent = getGreeting(now.getHours());
    dateText.textContent = dateFormatter.format(now);
    timeText.textContent = timeFormatter.format(now);
  }

  updateClock();
  window.setInterval(updateClock, 1000);
})();
