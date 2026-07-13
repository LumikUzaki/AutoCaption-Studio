#!/usr/bin/env python3
"""
Transcrição de áudio/vídeo usando engines Whisper
Suporta: faster-whisper, stable-ts, whisperx
"""

import argparse
import json
import sys
import os
from pathlib import Path

def parse_args():
    parser = argparse.ArgumentParser(description='Transcrever áudio/vídeo com Whisper')
    parser.add_argument('--transcricao-id', required=True, help='ID da transcrição')
    parser.add_argument('--video-path', required=True, help='Caminho do arquivo de vídeo/áudio')
    parser.add_argument('--engine', default='faster-whisper', 
                       choices=['faster-whisper', 'stable-ts', 'whisperx'],
                       help='Engine de transcrição')
    parser.add_argument('--model', default='base',
                       choices=['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3'],
                       help='Modelo Whisper')
    parser.add_argument('--device', default='cuda',
                       choices=['cuda', 'cpu'],
                       help='Dispositivo de processamento')
    parser.add_argument('--language', default='pt',
                       help='Idioma do áudio (código ISO)')
    return parser.parse_args()

def transcribe_faster_whisper(video_path, model, device, language):
    """Transcrição usando faster-whisper"""
    try:
        from faster_whisper import WhisperModel
        
        # Mapear nome do modelo
        model_size = model
        if model == 'large-v2':
            model_size = 'large-v2'
        elif model == 'large-v3':
            model_size = 'large-v3'
        
        # Carregar modelo
        compute_type = "float16" if device == "cuda" else "int8"
        whisper_model = WhisperModel(model_size, device=device, compute_type=compute_type)
        
        # Transcrever
        segments, info = whisper_model.transcribe(
            video_path,
            language=language if language != 'auto' else None,
            word_timestamps=True
        )
        
        resultados = []
        for segment in segments:
            resultados.append({
                'start_time': segment.start,
                'end_time': segment.end,
                'text': segment.text.strip(),
                'confidence': segment.avg_logprob if hasattr(segment, 'avg_logprob') else None
            })
        
        return resultados
    
    except ImportError:
        print("Erro: faster-whisper não instalado. Execute: pip install faster-whisper", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Erro na transcrição: {str(e)}", file=sys.stderr)
        sys.exit(1)

def transcribe_stable_ts(video_path, model, device, language):
    """Transcrição usando stable-ts"""
    try:
        import stable_whisper
        
        # Carregar modelo
        whisper_model = stable_whisper.load_model(model, device=device)
        
        # Transcrever
        result = whisper_model.transcribe(
            video_path,
            language=language if language != 'auto' else None,
            word_timestamps=True
        )
        
        resultados = []
        for segment in result['segments']:
            resultados.append({
                'start_time': segment['start'],
                'end_time': segment['end'],
                'text': segment['text'].strip(),
                'confidence': segment.get('avg_logprob')
            })
        
        return resultados
    
    except ImportError:
        print("Erro: stable-ts não instalado. Execute: pip install stable-ts", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Erro na transcrição: {str(e)}", file=sys.stderr)
        sys.exit(1)

def transcribe_whisperx(video_path, model, device, language):
    """Transcrição usando whisperx"""
    try:
        import whisperx
        
        # Carregar modelo
        whisper_model = whisperx.load_model(
            model,
            device,
            language=language if language != 'auto' else None
        )
        
        # Transcrever
        audio = whisperx.load_audio(video_path)
        result = whisper_model.transcribe(audio, batch_size=16)
        
        # Alinhar timestamps
        model_a, metadata = whisperx.load_align_model(
            language_code=result["language"],
            device=device
        )
        result = whisperx.align(result["segments"], model_a, metadata, audio, device)
        
        resultados = []
        for segment in result['segments']:
            resultados.append({
                'start_time': segment['start'],
                'end_time': segment['end'],
                'text': segment['text'].strip(),
                'confidence': segment.get('score')
            })
        
        return resultados
    
    except ImportError:
        print("Erro: whisperx não instalado. Execute: pip install whisperx", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Erro na transcrição: {str(e)}", file=sys.stderr)
        sys.exit(1)

def main():
    args = parse_args()
    
    # Validar arquivo
    if not os.path.exists(args.video_path):
        print(f"Erro: Arquivo não encontrado: {args.video_path}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Iniciando transcrição com {args.engine}...")
    print(f"Arquivo: {args.video_path}")
    print(f"Modelo: {args.model}")
    print(f"Dispositivo: {args.device}")
    print(f"Idioma: {args.language}")
    
    # Selecionar engine
    if args.engine == 'faster-whisper':
        segmentos = transcribe_faster_whisper(
            args.video_path,
            args.model,
            args.device,
            args.language
        )
    elif args.engine == 'stable-ts':
        segmentos = transcribe_stable_ts(
            args.video_path,
            args.model,
            args.device,
            args.language
        )
    elif args.engine == 'whisperx':
        segmentos = transcribe_whisperx(
            args.video_path,
            args.model,
            args.device,
            args.language
        )
    else:
        print(f"Engine desconhecida: {args.engine}", file=sys.stderr)
        sys.exit(1)
    
    # Output em JSON para o backend processar
    output = {
        'transcricao_id': args.transcricao_id,
        'total_segmentos': len(segmentos),
        'segmentos': segmentos
    }
    
    print(json.dumps(output, ensure_ascii=False))
    print(f"Transcrição concluída! {len(segmentos)} segmentos gerados.")

if __name__ == '__main__':
    main()
