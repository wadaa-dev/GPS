const defaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  shadowSize:  [41, 41],
  shadowAnchor:[12, 41]
});
L.Marker.prototype.options.icon = defaultIcon;

const socket = io();
let map = L.map('map').setView([35.1318, 36.7578], 13);
let marker, routeLine, routeMarkers = [];
const statusEl = document.getElementById('status');
const debugEl  = document.getElementById('debug');
const dateInput = document.getElementById('dateFilter');

const urlParams = new URLSearchParams(window.location.search);
const childId = urlParams.get('childId');
if (!childId) {
  location.href = 'tracking.html'; 
}

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function updateMarker(lat, lng) {
  if (!marker) marker = L.marker([lat, lng]).addTo(map);
  else marker.setLatLng([lat, lng]);
  map.setView([lat, lng], 15);
}

function getCurrentDate() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth()+1).padStart(2,'0'),
    String(today.getDate()).padStart(2,'0')
  ].join('-');
}

function loadHistory(date) {
  console.log('>>> loadHistory called → childId =', childId, ', date =', date);

  if (!date) return;
  if (routeLine) map.removeLayer(routeLine);
  routeMarkers.forEach(m => map.removeLayer(m));
  routeMarkers = [];
  document.querySelector('#movementTable tbody').innerHTML = '';
  debugEl.textContent = '';

  fetch(`/location-history/${childId}/${date}`)
    .then(res => {
      console.log('fetch /location-history status:', res.status);
      return res.json();
    })
    .then(data => {
      console.log('→ data from /location-history:', data);
      debugEl.textContent = JSON.stringify(data, null, 2);

      if (data.length) {
        const latlngs = data.map(p => [p.lat, p.lng]);
        routeLine = L.polyline(latlngs, { color: 'blue' }).addTo(map);

        data.forEach(p => {
          const lat = Number(p.lat), lng = Number(p.lng);
          const m = L.circleMarker([lat, lng], {
            radius: 8,
            color: 'red',
            weight: 2,
            fillColor: 'red',
            fillOpacity: 0.8
          }).addTo(map);
          routeMarkers.push(m);

          const time = p.timestamp
            ? new Date(p.timestamp).toLocaleTimeString()
            : '--';
          const row = `<tr>
                         <td style="color: #333;">${time}</td>
                         <td style="color: #006400;">${lat.toFixed(5)}</td>
                         <td style="color: #00008B;">${lng.toFixed(5)}</td>
                       </tr>`;
          document.querySelector('#movementTable tbody')
                  .insertAdjacentHTML('beforeend', row);
        });

        map.fitBounds(routeLine.getBounds());
        statusEl.textContent = '';
      } else {
        statusEl.textContent = '⚠️ لا توجد بيانات تحرك لهذا التاريخ';
      }
    })
    .catch(err => {
      console.error(err);
      statusEl.textContent = '⚠️ خطأ في جلب سجل التحركات';
    });
}

const today = getCurrentDate();
dateInput.value = today;
fetch(`/latest-location/${childId}`)
  .then(r => r.json())
  .then(d => {
    if (d.lat != null && d.lng != null) updateMarker(d.lat, d.lng);
    loadHistory(today);
  })
  .catch(() => statusEl.textContent = '⚠️ خطأ في جلب آخر موقع');

dateInput.addEventListener('change', () => loadHistory(dateInput.value));

socket.on('locationUpdate', ({ child_id, lat, lng }) => {
  if (String(child_id) === childId) {
    updateMarker(lat, lng);
    loadHistory(dateInput.value);

    if (Notification.permission === "granted") {
      console.log("إذن الإشعارات تم منحه");
      new Notification('تم تحديث الموقع', {
        body: `الموقع الجديد للطفل هو: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        icon: 'icon.png' 
      });
    } else {
      console.log("إذن الإشعارات غير متاح");
    }
  }
});

if (Notification.permission !== "granted" && Notification.permission !== "denied") {
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      console.log('تم منح الإذن للإشعارات');
    } else {
      console.log('تم رفض الإذن للإشعارات');
    }
  });
}

function sendLocationToServer(lat, lng) {
  fetch('/update-location', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      child_id: childId,  
      lat: lat,
      lng: lng
    })
  }).then(response => {
    if (response.ok) {
      console.log("تم تحديث الموقع بنجاح");
    } else {
      console.error("حدث خطأ أثناء إرسال الموقع");
    }
  });
}

if (navigator.geolocation) {
  setInterval(() => {
    navigator.geolocation.getCurrentPosition(function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      sendLocationToServer(lat, lng); 
    }, function(error) {
      console.error('فشل الحصول على الموقع: ', error);
    });
  }, 5000); 
} else {
  console.log('المتصفح لا يدعم تحديد الموقع الجغرافي');
}
