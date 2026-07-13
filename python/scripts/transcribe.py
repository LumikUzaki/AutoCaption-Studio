"""
Script Principal de Transcrição - legendas-pro
Orquestra a execução das engines Python baseado nos parâmetros recebidos do Node.js.

Uso:
    python transcribe.py <audio_path> <engine> <model_name> <device> [language]

Args:
    audio_path: Caminho para o arquivo de áudio extraído
    engine: 'faster', 'stable' ou 'whisperx'
    model_name: Nome do modelo Whisper
    device: 'cuda' ou 'cpu'
    language: (Opcional) Código do idioma (pt, en, es, etc.) ou 'None' para auto-detect
"""
import sys
import os
import json

# Adicionar diretório de engines ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'engines'))

def main():
    if len(sys.argv) < 5:
        error_response = {
            "success": False,
            "error": f"Argumentos insuficientes. Esperado: audio_path, engine, model_name, device. Recebido: {len(sys.argv) - 1}"
        }
        print(json.dumps(error_response, ensure_ascii=False))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    engine_name = sys.argv[2].lower()
    model_name = sys.argv[3]
    device = sys.argv[4]
    language = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] != "None" else None
    
    # Validar caminho do arquivo
    if not os.path.exists(audio_path):
        error_response = {
            "success": False,
            "error": f"Arquivo de áudio não encontrado: {audio_path}"
        }
        print(json.dumps(error_response, ensure_ascii=False))
        sys.exit(1)
    
    # Selecionar engine
    try:
        if engine_name == "faster":
            from faster_whisper_engine import transcribe
        elif engine_name == "stable":
            from stable_ts_engine import transcribe
        elif engine_name == "whisperx":
            from whisperx_engine import transcribe
        else:
            raise ValueError(f"Engine desconhecida: {engine_name}. Use 'faster', 'stable' ou 'whisperx'.")
        
        # Executar transcrição
        result = transcribe(audio_path, model_name, device, language)
        
        # Imprimir resultado como JSON
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_response = {
            "success": False,
            "error": f"Erro na execução da engine {engine_name}: {str(e)}"
        }
        print(json.dumps(error_response, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
