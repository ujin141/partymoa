/**
 * 서비스 워커 — 푸시를 받는 유일한 자리.
 *
 * **캐시는 안 한다.** 잔여 자리와 입금 상태가 초 단위로 바뀌는 앱이라,
 * 오래된 화면을 보여 주는 게 안 보여 주는 것보다 나쁘다.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "파티모아", {
      body: d.body || "",
      icon: "/appicon.png",
      badge: "/appicon.png",
      data: { url: d.url || "/tickets" },
      // 같은 예매로 두 번 뜨면 잔소리가 된다
      tag: d.tag || "partymoa",
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // 이미 열려 있으면 그 창을 쓴다. 창을 자꾸 새로 여는 앱은 미움받는다
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
