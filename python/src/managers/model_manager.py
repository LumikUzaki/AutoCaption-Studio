"""
Model Manager - Gerenciamento de modelos de IA
"""

import os
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger('python-bridge.models')


class ModelManager:
    """Gerencia download, cache e carregamento de modelos de IA"""
    
    def __init__(self, gpu_manager):
        self.gpu_manager = gpu_manager
        self.models_dir = Path("/workspace/python/models")
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Modelos pré-definidos
        self.transcription_models = [
            "tiny", "base", "small", "medium", "large-v2", "large-v3"
        ]
        
        self.translation_models = [
            "argos", "marianmt", "nllb"
        ]
    
    def list_available_models(self) -> List[Dict[str, Any]]:
        """Lista modelos disponíveis no diretório"""
        models = []
        
        # Verificar modelos de transcrição
        for model_name in self.transcription_models:
            model_path = self.models_dir / f"whisper-{model_name}"
            exists = model_path.exists()
            
            models.append({
                "name": model_name,
                "type": "transcription",
                "exists": exists,
                "path": str(model_path) if exists else None,
                "size_gb": self._get_model_size(model_path) if exists else 0
            })
        
        # Verificar modelos de tradução
        for model_name in self.translation_models:
            models.append({
                "name": model_name,
                "type": "translation",
                "exists": True,  # São carregados sob demanda
                "path": None,
                "size_gb": 0
            })
        
        return models
    
    def get_model_path(self, model_name: str, model_type: str) -> Optional[str]:
        """Retorna caminho do modelo se existir"""
        if model_type == 'transcription':
            model_path = self.models_dir / f"whisper-{model_name}"
            if model_path.exists():
                return str(model_path)
            return None
        return None
    
    def download_model(self, model_name: str, model_type: str) -> Dict[str, Any]:
        """Baixa modelo"""
        try:
            if model_type == 'transcription':
                return self._download_transcription_model(model_name)
            else:
                return {"error": f"Tipo de modelo '{model_type}' não suportado"}
        except Exception as e:
            logger.error(f"Erro ao baixar modelo: {e}")
            return {"error": str(e)}
    
    def _download_transcription_model(self, model_name: str) -> Dict[str, Any]:
        """Baixa modelo de transcrição"""
        from faster_whisper import WhisperModel
        
        model_path = self.models_dir / f"whisper-{model_name}"
        
        if model_path.exists():
            logger.info(f"Modelo {model_name} já existe")
            return {
                "success": True,
                "message": "Modelo já está baixado",
                "path": str(model_path)
            }
        
        logger.info(f"Baixando modelo {model_name}...")
        
        try:
            # Download usando faster-whisper
            device = "cuda" if self.gpu_manager.has_gpu() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            
            # Carregar modelo (faz download automático)
            model = WhisperModel(model_name, device=device, compute_type=compute_type)
            
            # Mover para diretório de modelos
            # O modelo é cacheado automaticamente pelo huggingface
            
            return {
                "success": True,
                "message": f"Modelo {model_name} baixado com sucesso",
                "path": str(model_path)
            }
            
        except Exception as e:
            logger.error(f"Erro no download: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def delete_model(self, model_name: str) -> Dict[str, Any]:
        """Deleta modelo"""
        try:
            model_path = self.models_dir / f"whisper-{model_name}"
            
            if not model_path.exists():
                return {
                    "success": False,
                    "error": "Modelo não encontrado"
                }
            
            # Remover diretório do modelo
            import shutil
            shutil.rmtree(model_path)
            
            logger.info(f"Modelo {model_name} removido")
            
            return {
                "success": True,
                "message": f"Modelo {model_name} removido com sucesso"
            }
            
        except Exception as e:
            logger.error(f"Erro ao remover modelo: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """Retorna informações do modelo"""
        model_path = self.models_dir / f"whisper-{model_name}"
        exists = model_path.exists()
        
        # Tamanhos aproximados dos modelos
        model_sizes = {
            "tiny": 0.15,
            "base": 0.15,
            "small": 0.5,
            "medium": 1.5,
            "large-v2": 3.1,
            "large-v3": 3.1
        }
        
        return {
            "name": model_name,
            "type": "transcription",
            "exists": exists,
            "path": str(model_path) if exists else None,
            "size_gb": model_sizes.get(model_name, 0),
            "recommended_vram_gb": model_sizes.get(model_name, 0) * 2
        }
    
    def _get_model_size(self, model_path: Path) -> float:
        """Retorna tamanho do modelo em GB"""
        if not model_path.exists():
            return 0.0
        
        total_size = 0
        for dirpath, dirnames, filenames in os.walk(model_path):
            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                total_size += os.path.getsize(file_path)
        
        return round(total_size / (1024 * 1024 * 1024), 2)
    
    def clear_cache(self) -> Dict[str, Any]:
        """Limpa cache de modelos"""
        try:
            # Limpar cache do HuggingFace
            from huggingface_hub import scan_cache_dir, delete_cache
            
            cache_info = scan_cache_dir()
            deleted_repos = []
            
            for repo in cache_info.repos:
                if repo.repo_id.startswith("openai/whisper"):
                    delete_cache(repo.repo_id)
                    deleted_repos.append(repo.repo_id)
            
            logger.info(f"Cache limpo: {len(deleted_repos)} repositórios")
            
            return {
                "success": True,
                "deleted_repos": deleted_repos
            }
            
        except Exception as e:
            logger.error(f"Erro ao limpar cache: {e}")
            return {
                "success": False,
                "error": str(e)
            }
