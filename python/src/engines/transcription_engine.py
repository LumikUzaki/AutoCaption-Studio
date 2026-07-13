"""
Engine de Transcrição - Suporte a múltiplas engines (Faster-Whisper, Stable-ts, WhisperX)
"""

import logging
from typing import Dict, Any, List, Optional
from ..managers.model_manager import ModelManager
from ..managers.gpu_manager import GPUManager

logger = logging.getLogger('python-bridge.transcription')


class TranscriptionEngine:
    """Engine unificada para transcrição de áudio"""
    
    def __init__(self, model_manager: ModelManager, gpu_manager: GPUManager):
        self.model_manager = model_manager
        self.gpu_manager = gpu_manager
        self._engines = {}
    
    def transcribe(
        self,
        audio_path: str,
        engine_name: str = 'faster-whisper',
        model_name: str = 'base',
        language: str = 'auto',
        **options
    ) -> Dict[str, Any]:
        """
        Transcreve áudio completo
        
        Args:
            audio_path: Caminho para o arquivo de áudio
            engine_name: Nome da engine ('faster-whisper', 'stable-ts', 'whisperx')
            model_name: Nome do modelo ('tiny', 'base', 'small', 'medium', 'large-v3')
            language: Código do idioma ou 'auto' para detecção automática
            **options: Opções adicionais (beamSize, wordTimestamps, etc.)
        
        Returns:
            Dict com segments, language e duration
        """
        logger.info(f"Iniciando transcrição com {engine_name} ({model_name})")
        
        try:
            if engine_name == 'faster-whisper':
                result = self._transcribe_faster_whisper(
                    audio_path, model_name, language, **options
                )
            elif engine_name == 'stable-ts':
                result = self._transcribe_stable_ts(
                    audio_path, model_name, language, **options
                )
            elif engine_name == 'whisperx':
                result = self._transcribe_whisperx(
                    audio_path, model_name, language, **options
                )
            else:
                raise ValueError(f"Engine '{engine_name}' não suportada")
            
            logger.info(f"Transcrição concluída: {len(result.get('segments', []))} segmentos")
            return result
            
        except Exception as e:
            logger.error(f"Erro na transcrição: {str(e)}", exc_info=True)
            raise
    
    def _transcribe_faster_whisper(
        self,
        audio_path: str,
        model_name: str,
        language: str,
        **options
    ) -> Dict[str, Any]:
        """Transcrição usando Faster-Whisper"""
        try:
            from faster_whisper import WhisperModel
            
            # Determinar dispositivo
            device = "cuda" if self.gpu_manager.has_gpu() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            
            logger.info(f"Carregando modelo {model_name} em {device}")
            
            # Carregar modelo
            model_path = self.model_manager.get_model_path(model_name, 'transcription')
            model = WhisperModel(
                model_path if model_path else model_name,
                device=device,
                compute_type=compute_type
            )
            
            # Configurar opções
            beam_size = options.get('beamSize', 5)
            word_timestamps = options.get('wordTimestamps', True)
            vad_filter = options.get('vadFilter', True)
            
            # Transcrever
            logger.info("Iniciando transcrição...")
            segments, info = model.transcribe(
                audio_path,
                language=language if language != 'auto' else None,
                beam_size=beam_size,
                word_timestamps=word_timestamps,
                vad_filter=vad_filter
            )
            
            # Processar segmentos
            result_segments = []
            for segment in segments:
                seg_dict = {
                    "start": round(segment.start, 3),
                    "end": round(segment.end, 3),
                    "text": segment.text.strip(),
                    "confidence": segment.avg_logprob
                }
                
                if word_timestamps and hasattr(segment, 'words') and segment.words:
                    seg_dict["words"] = [
                        {
                            "start": round(w.start, 3),
                            "end": round(w.end, 3),
                            "text": w.word.strip(),
                            "confidence": getattr(w, 'probability', 0.0)
                        }
                        for w in segment.words
                    ]
                
                result_segments.append(seg_dict)
            
            return {
                "segments": result_segments,
                "language": info.language if info else "unknown",
                "duration": info.duration if info else 0.0,
                "engine": "faster-whisper"
            }
            
        except ImportError:
            logger.warning("Faster-Whisper não disponível")
            raise RuntimeError("Faster-Whisper não está instalado")
        except Exception as e:
            logger.error(f"Erro no Faster-Whisper: {str(e)}")
            raise
    
    def _transcribe_stable_ts(
        self,
        audio_path: str,
        model_name: str,
        language: str,
        **options
    ) -> Dict[str, Any]:
        """Transcrição usando Stable-TS para timestamps precisos"""
        try:
            import stable_whisper
            import torch
            
            # Determinar dispositivo
            device = "cuda" if self.gpu_manager.has_gpu() else "cpu"
            
            logger.info(f"Carregando modelo {model_name} com stable-ts em {device}")
            
            # Carregar modelo
            model_path = self.model_manager.get_model_path(model_name, 'transcription')
            model = stable_whisper.load_model(
                model_path if model_path else model_name,
                device=device
            )
            
            # Transcrever
            logger.info("Iniciando transcrição com stable-ts...")
            result = model.transcribe(
                audio_path,
                language=language if language != 'auto' else None,
                verbose=False
            )
            
            # Processar segmentos
            result_segments = []
            for segment in result.segments:
                seg_dict = {
                    "start": round(segment.start, 3),
                    "end": round(segment.end, 3),
                    "text": segment.text.strip()
                }
                
                if hasattr(segment, 'words') and segment.words:
                    seg_dict["words"] = [
                        {
                            "start": round(w.start, 3),
                            "end": round(w.end, 3),
                            "text": w.word.strip()
                        }
                        for w in segment.words
                    ]
                
                result_segments.append(seg_dict)
            
            return {
                "segments": result_segments,
                "language": result.language if hasattr(result, 'language') else "unknown",
                "duration": result.duration if hasattr(result, 'duration') else 0.0,
                "engine": "stable-ts"
            }
            
        except ImportError:
            logger.warning("Stable-TS não disponível")
            raise RuntimeError("Stable-TS não está instalado")
        except Exception as e:
            logger.error(f"Erro no Stable-TS: {str(e)}")
            raise
    
    def _transcribe_whisperx(
        self,
        audio_path: str,
        model_name: str,
        language: str,
        **options
    ) -> Dict[str, Any]:
        """Transcrição usando WhisperX com alinhamento e diarização"""
        try:
            import whisperx
            import torch
            
            # Determinar dispositivo
            device = "cuda" if self.gpu_manager.has_gpu() else "cpu"
            
            logger.info(f"Carregando WhisperX {model_name} em {device}")
            
            # Carregar modelo
            model_path = self.model_manager.get_model_path(model_name, 'transcription')
            model = whisperx.load_model(
                model_path if model_path else model_name,
                device=device,
                language=language if language != 'auto' else None
            )
            
            # Transcrever
            logger.info("Iniciando transcrição com WhisperX...")
            result = model.transcribe(audio_path)
            
            # Alinhamento de palavras
            model_aligned, metadata = whisperx.load_align_model(
                language_code=result["language"],
                device=device
            )
            result = whisperx.align(
                result["segments"],
                model_aligned,
                metadata,
                audio_path,
                device
            )
            
            # Processar segmentos
            result_segments = []
            for segment in result["segments"]:
                seg_dict = {
                    "start": round(segment["start"], 3),
                    "end": round(segment["end"], 3),
                    "text": segment["text"].strip()
                }
                
                if "words" in segment:
                    seg_dict["words"] = [
                        {
                            "start": round(w["start"], 3),
                            "end": round(w["end"], 3),
                            "text": w["word"].strip()
                        }
                        for w in segment["words"]
                    ]
                
                result_segments.append(seg_dict)
            
            return {
                "segments": result_segments,
                "language": result.get("language", "unknown"),
                "duration": result.get("duration", 0.0),
                "engine": "whisperx"
            }
            
        except ImportError:
            logger.warning("WhisperX não disponível")
            raise RuntimeError("WhisperX não está instalado")
        except Exception as e:
            logger.error(f"Erro no WhisperX: {str(e)}")
            raise
    
    def transcribe_segment(
        self,
        audio_path: str,
        start: float,
        end: Optional[float],
        engine_name: str = 'faster-whisper',
        model_name: str = 'base'
    ) -> Dict[str, Any]:
        """Transcreve segmento específico de áudio"""
        # Extrair segmento com ffmpeg-python
        import ffmpeg
        
        try:
            # Criar arquivo temporário com segmento
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                tmp_path = tmp.name
            
            # Extrair segmento
            (
                ffmpeg
                .input(audio_path, ss=start, t=(end - start) if end else None)
                .output(tmp_path, acodec='pcm_s16le', ar='16000', ac=1)
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            
            # Transcrever segmento
            result = self.transcribe(
                audio_path=tmp_path,
                engine_name=engine_name,
                model_name=model_name,
                language='auto'
            )
            
            # Ajustar timestamps
            for segment in result.get('segments', []):
                segment['start'] += start
                segment['end'] += start
                if 'words' in segment:
                    for word in segment['words']:
                        word['start'] += start
                        word['end'] += start
            
            # Limpar arquivo temporário
            import os
            os.unlink(tmp_path)
            
            return result
            
        except Exception as e:
            logger.error(f"Erro ao transcrever segmento: {str(e)}")
            raise
    
    def detect_language(self, audio_path: str) -> Dict[str, Any]:
        """Detecta idioma do áudio"""
        try:
            from faster_whisper import WhisperModel
            
            # Carregar modelo tiny para detecção rápida
            device = "cuda" if self.gpu_manager.has_gpu() else "cpu"
            model = WhisperModel("tiny", device=device)
            
            # Transcrever primeiros 30 segundos para detecção
            _, info = model.transcribe(audio_path, language=None, task="lang_id")
            
            return {
                "language": info.language,
                "confidence": info.language_probability,
                "all_languages": [
                    {"language": lang[0], "confidence": lang[1]}
                    for lang in info.all_language_probs
                ][:5]  # Top 5 idiomas
            }
            
        except Exception as e:
            logger.error(f"Erro ao detectar idioma: {str(e)}")
            raise
