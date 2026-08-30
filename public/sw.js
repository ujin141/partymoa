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
      //
      // **그 창을 알림이 가리키는 곳으로 옮긴다.** 예전에는 주소가 겹칠
      // 때만 그 창을 썼는데, 그러면 /tickets 를 열어 둔 사람에게
      // /tickets?t=coupon 알림이 오면 창이 하나 더 뜬다. 같은 앱이 두 개
      // 열린 꼴이라 어느 쪽이 진짜인지 알 수 없게 된다
      for (const c of list) {
        if (!c.url.startsWith(self.location.origin)) continue;
        if (c.url.endsWith(url)) return "focus" in c ? c.focus() : undefined;
        if ("navigate" in c) {
          // navigate 는 창이 서비스워커 통제 밖이면 거절한다. 그때는
          // 새 창을 연다 — 눌렀는데 아무 일도 안 일어나는 게 제일 나쁘다
          return c
            .navigate(url)
            .then((x) => (x && "focus" in x ? x.focus() : undefined))
            .catch(() => self.clients.openWindow(url));
        }
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
