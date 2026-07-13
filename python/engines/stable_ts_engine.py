"""
Engine: Stable-ts
Descrição: Versão modificada do Whisper com timestamps de nível de palavra de alta precisão.
Configuração focada em extrair word-level timestamps com máxima acurácia.
"""
import sys
import json
import stable_ts as st

def transcribe(audio_path, model_name, device, language=None):
    """
    Transcreve áudio usando stable-ts com foco em precisão de timestamps.
    
    Args:
        audio_path: Caminho para o arquivo de áudio
        model_name: Nome do modelo (tiny, base, small, medium, large-v3, etc.)
        device: 'cuda' ou 'cpu'
        language: Código do idioma ou None para auto-detect
    
    Returns:
        JSON com segmentos e words detalhadas
    """
    try:
        # Carregar modelo
        model = st.load_model(model_name, device=device)
        
        # Opções para máxima precisão de word-level timestamps
        result = model.transcribe(
            audio_path,
            language=language,
            vad=True,  # Voice Activity Detection
            word_timestamps=True,  # Habilitar word-level
            regroup=True,  # Reagrupar segmentos para melhor coerência
            ts_num=3,  # Número de iterações para refinamento de timestamps
            min_word_dur=0.1,  # Duração mínima da palavra
            only_voice_freq=False
        )
        
        # Processar resultado para formato padronizado
        segments_data = []
        
        for segment in result.segments:
            words_data = []
            if hasattr(segment, 'words') and segment.words:
                for word in segment.words:
                    words_data.append({
                        "start": word.start,
                        "end": word.end,
                        "text": word.text.strip(),
                        "probability": getattr(word, 'probability', 0.0)
                    })
            
            segments_data.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": words_data
            })
        
        return {
            "success": True,
            "language": result.language,
            "segments": segments_data
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
