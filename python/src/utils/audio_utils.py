"""
Utilitários de áudio e processamento
"""

import logging
import subprocess
from pathlib import Path
from typing import Optional

logger = logging.getLogger('python-bridge.utils')


def extract_audio(
    video_path: str,
    output_path: str,
    sample_rate: int = 16000,
    channels: int = 1
) -> bool:
    """
    Extrai áudio de vídeo usando FFmpeg
    
    Args:
        video_path: Caminho do vídeo
        output_path: Caminho de saída do áudio
        sample_rate: Taxa de amostragem (padrão: 16000 para Whisper)
        channels: Número de canais (padrão: 1 para mono)
    
    Returns:
        True se sucesso, False se falhou
    """
    try:
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-vn',  # Sem vídeo
            '-acodec', 'pcm_s16le',  # PCM 16-bit
            '-ar', str(sample_rate),
            '-ac', str(channels),
            '-y',  # Sobrescrever
            output_path
        ]
        
        logger.debug(f"Executando: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutos timeout
        )
        
        if result.returncode != 0:
            logger.error(f"FFmpeg erro: {result.stderr}")
            return False
        
        logger.info(f"Áudio extraído: {output_path}")
        return True
        
    except subprocess.TimeoutExpired:
        logger.error("Timeout na extração de áudio")
        return False
    except Exception as e:
        logger.error(f"Erro na extração de áudio: {e}")
        return False


def get_audio_duration(audio_path: str) -> Optional[float]:
    """Retorna duração do áudio em segundos"""
    try:
        import ffmpeg
        probe = ffmpeg.probe(audio_path)
        duration = float(probe['format']['duration'])
        return duration
    except Exception as e:
        logger.error(f"Erro ao obter duração: {e}")
        return None


def normalize_audio(audio_path: str, output_path: str) -> bool:
    """Normaliza volume do áudio"""
    try:
        cmd = [
            'ffmpeg',
            '-i', audio_path,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-y',
            output_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            logger.error(f"FFmpeg erro na normalização: {result.stderr}")
            return False
        
        logger.info(f"Áudio normalizado: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Erro na normalização: {e}")
        return False


def split_audio_by_segments(
    audio_path: str,
    segments: list,
    output_dir: str
) -> list:
    """
    Divide áudio em segmentos
    
    Args:
        audio_path: Caminho do áudio original
        segments: Lista de segmentos com start/end
        output_dir: Diretório de saída
    
    Returns:
        Lista de caminhos dos arquivos divididos
    """
    output_paths = []
    
    try:
        for i, segment in enumerate(segments):
            start = segment.get('start', 0)
            end = segment.get('end', start + 5)
            duration = end - start
            
            output_path = Path(output_dir) / f"segment_{i:04d}.wav"
            
            cmd = [
                'ffmpeg',
                '-i', audio_path,
                '-ss', str(start),
                '-t', str(duration),
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                '-y',
                str(output_path)
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                output_paths.append(str(output_path))
            else:
                logger.warning(f"Falha ao dividir segmento {i}")
        
        logger.info(f"{len(output_paths)} segmentos criados")
        return output_paths
        
    except Exception as e:
        logger.error(f"Erro ao dividir áudio: {e}")
        return output_paths


def cleanup_temp_files(paths: list) -> int:
    """Remove arquivos temporários"""
    removed = 0
    for path in paths:
        try:
            p = Path(path)
            if p.exists():
                p.unlink()
                removed += 1
        except Exception as e:
            logger.warning(f"Erro ao remover {path}: {e}")
    return removed


def format_timestamp(seconds: float, format_type: str = 'srt') -> str:
    """
    Formata timestamp em segundos para string
    
    Args:
        seconds: Tempo em segundos
        format_type: 'srt', 'vtt', 'ass'
    
    Returns:
        Timestamp formatado
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millisecs = int((seconds % 1) * 1000)
    
    if format_type in ['srt', 'vtt']:
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"
    elif format_type == 'ass':
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millisecs:02d}"
    else:
        return f"{seconds:.3f}"
