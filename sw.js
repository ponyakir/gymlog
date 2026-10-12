// GymLog service worker — network-first
// קבצי האפליקציה נטענים תמיד מהרשת; המטמון משמש רק כשאין אינטרנט.
// בכל שחרור: לעדכן את CACHE (אותו מספר כמו APP_VER ב-index.html).
const CACHE = 'gymlog-12.10.26';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // כל קובץ בנפרד — קובץ חסר (למשל אייקון) לא מפיל את ההתקנה
      return Promise.all(CORE.map(function(u){
        return fetch(u, {cache:'no-cache'}).then(function(r){ if(r.ok) return c.put(u, r); }).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);

  // קבצים חיצוניים (גופנים): מהמטמון אם יש, ובמקביל רענון ברקע
  if(url.origin !== self.location.origin){
    e.respondWith(
      caches.open(CACHE).then(function(c){
        return c.match(req).then(function(hit){
          var net = fetch(req).then(function(r){ if(r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(function(){ return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  // קבצי האפליקציה: רשת קודם (עוקף גם את מטמון הדפדפן), מטמון רק בלי אינטרנט
  e.respondWith(
    fetch(url.href, {cache:'no-cache', credentials:'same-origin'}).then(function(r){
      if(r && r.ok){
        var copy = r.clone();
        caches.open(CACHE).then(function(c){ c.put(req.mode === 'navigate' ? './index.html' : req, copy); });
      }
      return r;
    }).catch(function(){
      return caches.match(req, {ignoreSearch:true}).then(function(hit){
        return hit || caches.match('./index.html');
      });
    })
  );
});
