"""
Engine: WhisperX
Descrição: Whisper com alinhamento forçado, VAD avançado e normalização.
Focado em resultados "mais perfeitos" com opções extras ativadas.
"""
import sys
import json
import whisperx
import torch

def transcribe(audio_path, model_name, device, language=None):
    """
    Transcreve áudio usando whisperx com alinhamento forçado e VAD.
    
    Args:
        audio_path: Caminho para o arquivo de áudio
        model_name: Nome do modelo (tiny, base, small, medium, large-v3, etc.)
        device: 'cuda' ou 'cpu'
        language: Código do idioma ou None para auto-detect
    
    Returns:
        JSON com segmentos alinhados e words detalhadas
    """
    try:
        # Configurar dispositivo
        if device == "cuda":
            compute_type = "float16"
            batch_size = 16
        else:
            compute_type = "int8"
            batch_size = 4
        
        # Carregar modelo WhisperX
        model = whisperx.load_model(
            model_name, 
            device, 
            compute_type=compute_type,
            language=language
        )
        
        # Carregar áudio
        audio = whisperx.load_audio(audio_path)
        
        # Transcrição inicial
        result = model.transcribe(audio, batch_size=batch_size)
        
        # Detectar idioma se não fornecido
        detected_language = result.get("language", "en")
        if language is None:
            language = detected_language
        
        # Alinhamento forçado (word-level)
        # Carregar modelo de alinhamento
        align_model, align_metadata = whisperx.load_align_model(
            language_code=language, 
            device=device
        )
        
        # Realinhar timestamps das palavras
        result_aligned = whisperx.align(
            result["segments"],
            align_model,
            align_metadata,
            audio,
            device,
            return_char_alignments=False
        )
        
        # Opcional: Diarization (identificação de falantes) - pode ser ativado se necessário
        # diarize_model = whisperx.DiarizationPipeline(device=device)
        # diarize_segments = diarize_model(audio)
        # result_final = whisperx.assign_word_speakers(diarize_segments, result_aligned)
        
        # Processar resultado para formato padronizado
        segments_data = []
        
        for segment in result_aligned["segments"]:
            words_data = []
            if "words" in segment:
                for word in segment["words"]:
                    words_data.append({
                        "start": word.get("start", 0),
                        "end": word.get("end", 0),
                        "text": word.get("word", "").strip(),
                        "probability": word.get("score", 0.0)
                    })
            
            segments_data.append({
                "start": segment.get("start", 0),
                "end": segment.get("end", 0),
                "text": segment.get("text", "").strip(),
                "words": words_data
            })
        
        return {
            "success": True,
            "language": language,
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
