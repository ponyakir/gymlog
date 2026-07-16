/* GymLog Service Worker
   אסטרטגיה:
   - דף ה-HTML: רשת קודם (כדי שעדכונים שתעלה ייכנסו מיד), ואם אין אינטרנט — מהמטמון.
   - שאר הקבצים (אייקונים, manifest): מטמון קודם.
   - הנתונים עצמם ב-localStorage ולא מושפעים מה-SW בכלל.
*/
var CACHE = 'gymlog-v1';
var ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  // ניווט / דף ראשי: רשת קודם, מטמון כגיבוי
  if(req.mode === 'navigate' || req.url.match(/index\.html$|\/$/)){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(r){ return r || caches.match('./index.html'); });
      })
    );
    return;
  }

  // שאר הקבצים: מטמון קודם, רשת כגיבוי
  e.respondWith(
    caches.match(req).then(function(r){
      return r || fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      });
    })
  );
});
