"""
Engine: Faster Whisper
Descrição: Implementação otimizada do Whisper usando CTranslate2 para velocidade.
"""
import sys
import json
from faster_whisper import WhisperModel

def transcribe(audio_path, model_name, device, language=None):
    """
    Transcreve áudio usando faster-whisper.
    
    Args:
        audio_path: Caminho para o arquivo de áudio
        model_name: Nome do modelo (tiny, base, small, medium, large-v3, etc.)
        device: 'cuda' ou 'cpu'
        language: Código do idioma (ex: 'pt', 'en') ou None para auto-detect
    
    Returns:
        JSON com segmentos de transcrição
    """
    try:
        # Carregar modelo
        compute_type = "float16" if device == "cuda" else "int8"
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        
        segments, info = model.transcribe(
            audio_path,
            language=language,
            vad_filter=True,  # Filtrar silêncio
            word_timestamps=False  # Faster-whisper padrão não tem word-level preciso
        )
        
        result_segments = []
        for segment in segments:
            result_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": []  # Faster-whisper básico não retorna words detalhadas
            })
        
        return {
            "success": True,
            "language": info.language,
            "language_probability": info.language_probability,
            "segments": result_segments
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Argumentos insuficientes"}))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_name = sys.argv[2]
    device = sys.argv[3]
    language = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "None" else None
    
    result = transcribe(audio_path, model_name, device, language)
    print(json.dumps(result, ensure_ascii=False))
