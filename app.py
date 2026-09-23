import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# El CORS es vital para que tu GitHub Pages pueda comunicarse con este servidor sin bloqueos
CORS(app, resources={r"/*": {"origins": "*"}}) 

# Consigue tu API Key de Kling en su panel y añádela aquí o en tu archivo .env
KLING_API_KEY = os.environ.get("api-key-kling-PLCKoVoY4rAdlCvh5hSCPprqX4EYp5S0Ck_15KeLTwg", "105477641")
KLING_API_URL = "https://klingapi.com"

@app.route('/generar-video', codecs=['POST'])
def generar_video():
    try:
        datos_recibidos = request.json
        prompt = datos_recibidos.get('prompt')
        imagen_base64 = datos_recibidos.get('image') # Opcional si suben imagen
        
        # Estructura obligatoria para la API de Kling
        headers = {
            "Authorization": f"Bearer {KLING_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "kling/kling-v3-video-generation",
            "prompt": prompt,
            "duration": 10,
            "aspect_ratio": "16:9"
        }
        
        if imagen_base64:
            payload["start_image"] = imagen_base64

        # Enviar petición a Kling AI
        respuesta_kling = requests.post(KLING_API_URL, json=payload, headers=headers)
        
        if respuesta_kling.status_code != 200:
            return jsonify({"error": "Error en el servidor de Kling AI"}), respuesta_kling.status_code
            
        data_kling = respuesta_kling.json()
        # Devolvemos el task_id al frontend para que haga el seguimiento
        return jsonify({"success": True, "task_id": data_kling.get("data", {}).get("task_id")})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Ruta opcional para consultar el estado del video (Polling)
@app.route('/estado-video/<task_id>', methods=['GET'])
def estado_video(task_id):
    headers = {"Authorization": f"Bearer {KLING_API_KEY}"}
    url_estado = f"https://klingapi.com{task_id}"
    
    respuesta = requests.get(url_estado, headers=headers)
    return jsonify(respuesta.json())

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

