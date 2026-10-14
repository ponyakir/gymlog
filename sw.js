// GymLog service worker — network-first
// קבצי האפליקציה נטענים תמיד מהרשת; המטמון משמש רק כשאין אינטרנט.
// בכל שחרור: לעדכן את CACHE (אותו מספר כמו APP_VER ב-index.html).
const CACHE = 'gymlog-14.10.26';
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
  // בדיקת חיבור מהאפליקציה — תמיד לרשת, בלי גיבוי מהמטמון (אחרת המחוון היה ירוק גם בלי אינטרנט)
  if(url.searchParams.has('netcheck')) return;

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

  // קבצי האפליקציה: רשת קודם (עוקף גם את מטמון הדפדפן), מטמון רק בלי אינטרנט.
  // רשת איטית (מעל 5 שנ') בפתיחת האפליקציה → מוצג העותק מהמטמון במקום מסך שגיאה.
  var isNav = req.mode === 'navigate';
  function fromCache(){
    return caches.match(isNav ? './index.html' : req, {ignoreSearch:true}).then(function(hit){
      return hit || caches.match('./index.html');
    });
  }
  var net = fetch(url.href, {cache:'no-cache', credentials:'same-origin'}).then(function(r){
    if(r && r.ok){
      var copy = r.clone();
      caches.open(CACHE).then(function(c){ c.put(isNav ? './index.html' : req, copy); });
    }
    return r;
  });
  if(!isNav){
    e.respondWith(net.catch(fromCache));
    return;
  }
  e.respondWith(new Promise(function(resolve){
    var done = false;
    function finish(r){ if(!done && r){ done = true; resolve(r); } }
    var t = setTimeout(function(){ fromCache().then(finish); }, 5000);
    net.then(function(r){ clearTimeout(t); finish(r); })
       .catch(function(){ clearTimeout(t); fromCache().then(function(r){ finish(r || Response.error()); }); });
  }));
});
