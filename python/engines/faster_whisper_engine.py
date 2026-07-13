"""
Engine: Faster Whisper
Descrição: Implementação otimizada do Whisper usando CTranslate2 para velocidade.
"""
import sys
import json
from faster_whisper import WhisperModel

# Cache de modelos para evitar recarregamento
_model_cache = {}

def get_model(model_name, device, compute_type):
    """Retorna modelo em cache ou carrega novo."""
    cache_key = f"{model_name}_{device}_{compute_type}"
    if cache_key not in _model_cache:
        _model_cache[cache_key] = WhisperModel(model_name, device=device, compute_type=compute_type)
    return _model_cache[cache_key]

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
        # Carregar modelo com cache
        compute_type = "float16" if device == "cuda" else "int8"
        model = get_model(model_name, device, compute_type)
        
        # Otimizações de performance
        segments, info = model.transcribe(
            audio_path,
            language=language,
            vad_filter=True,  # Filtrar silêncio
            vad_parameters=dict(min_silence_duration_ms=500),
            word_timestamps=False,
            beam_size=1,  # Reduz beam search para velocidade
            best_of=1,
            temperature=0.0,  # Temperatura fixa para consistência
            compression_ratio_threshold=2.4,
            log_prob_threshold=-1.0
        )
        
        result_segments = []
        for segment in segments:
            result_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": []
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
