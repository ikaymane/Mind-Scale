from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        html = """
        <html><head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>#map{height:400px; width:90%; max-width:650px; margin:auto; border-radius:20px; border:3px solid green;}</style>
        </head><body style="font-family:Arial; text-align:center; background:#fff8e1; padding:20px;">
        <h1 style="color:#d32f2f;">🔥 FireMap Maroc 🔥</h1>
        <h2>🗺️ VRAIE CARTE DU MAROC</h2>
        <div id="map"></div>
        <p>🔴 = Feu &nbsp; 🟢 = Pas de feu</p>
        <div id="liste" style="background:#c8e6c9; width:90%; max-width:650px; margin:auto; border-radius:20px; padding:15px;">
        <p><b style="color:red;">🔴 Merzouga - Feu signalé</b></p>
        <p><b style="color:orange;">🟠 Errachidia - Attention</b></p>
        <p><b style="color:green;">🟢 Fès - Pas de feu</b></p>
        <p><b style="color:green;">🟢 Casablanca - Pas de feu</b></p>
        </div>
        <br>
        <div style="background:white; width:90%; max-width:650px; margin:auto; border-radius:15px; padding:20px; border:2px solid #ddd;">
        <h3>🚨 Signaler un feu</h3>
        <p>Où est le feu ?</p>
        <input id="ville" type="text" placeholder="Ex: Merzouga" style="padding:12px; font-size:16px; width:80%; border-radius:10px; border:1px solid #ccc;">
        <br><br>
        <button onclick="signaler()" style="background:red; color:white; padding:15px 30px; font-size:18px; border-radius:10px; border:none;">Envoyer 🚨</button>
        <p id="merci" style="color:green; font-weight:bold;"></p>
        </div>
        <script>
        var map = L.map('map').setView([31.8, -5.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        function point(lat, lon, texte, couleur){
          var c = couleur=="rouge" ? "red" : couleur=="orange" ? "orange" : "green";
          L.circleMarker([lat, lon], {color:c, fillColor:c, fillOpacity:0.9, radius:12}).addTo(map).bindPopup(texte);
        }
        point(31.09, -3.97, "🔴 Merzouga - Feu", "rouge");
        point(31.93, -4.42, "🟠 Errachidia - Attention", "orange");
        point(34.03, -5.0, "🟢 Fès - Pas de feu", "vert");
        point(33.57, -7.58, "🟢 Casablanca - Pas de feu", "vert");
        async function signaler(){
          var v = document.getElementById('ville').value;
          if(v == ""){ alert("Écris la ville d'abord !"); return; }
          var maintenant = new Date().toLocaleString('fr-FR');
          var p = document.createElement('p');
          p.innerHTML = "<b style='color:red;'>🔴 " + v + " - Feu signalé (nouveau !)</b><br><small>📅 " + maintenant + "</small><br><button onclick='eteindre(this)' style='background:green; color:white; padding:8px 15px; border-radius:8px; border:none; margin-top:5px;'>Feu éteint ✅</button>";
          document.getElementById('liste').appendChild(p);
          document.getElementById('merci').innerHTML = "Recherche de " + v + " sur la carte...";
          try{
            var r = await fetch("https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(v + ", Maroc"));
            var data = await r.json();
            if(data.length > 0){
              var lat = parseFloat(data[0].lat); var lon = parseFloat(data[0].lon);
              point(lat, lon, "🔴 " + v + " - Feu signalé", "rouge");
              map.setView([lat, lon], 9);
              document.getElementById('merci').innerHTML = "Merci ! Feu à " + v + " signalé sur la carte ✅";
            } else { document.getElementById('merci').innerHTML = "Merci ! Feu à " + v + " signalé ✅ (ville pas trouvée sur la carte)"; }
          }catch(e){ document.getElementById('merci').innerHTML = "Merci ! Feu à " + v + " signalé ✅"; }
          document.getElementById('ville').value = "";
        }
        function eteindre(btn){
          var p = btn.parentElement;
          p.innerHTML = "<b style='color:green;'>🟢 Feu éteint - Bravo !</b>";
        }
        </script>
        </body></html>
        """
        self.wfile.write(html.encode("utf-8"))

HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()