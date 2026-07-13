"""
GPU Manager - Gerenciamento de GPU NVIDIA e CUDA
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger('python-bridge.gpu')


class GPUManager:
    """Gerencia detecção e monitoramento de GPU NVIDIA"""
    
    def __init__(self):
        self._pynvml_available = False
        self._gpu_count = 0
        self._init_pynvml()
    
    def _init_pynvml(self):
        """Inicializa PyNVML para monitoramento de GPU"""
        try:
            import pynvml
            pynvml.nvmlInit()
            self._pynvml_available = True
            self._gpu_count = pynvml.nvmlDeviceGetCount()
            logger.info(f"PyNVML inicializado. GPUs detectadas: {self._gpu_count}")
        except ImportError:
            logger.warning("pynvml não disponível. Monitoramento de GPU desabilitado.")
            self._pynvml_available = False
        except Exception as e:
            logger.warning(f"Erro ao inicializar PyNVML: {e}")
            self._pynvml_available = False
    
    def has_gpu(self) -> bool:
        """Verifica se há GPU NVIDIA disponível"""
        return self._gpu_count > 0
    
    def get_gpu_info(self) -> Optional[Dict[str, Any]]:
        """Retorna informações da GPU"""
        if not self._pynvml_available or self._gpu_count == 0:
            return None
        
        try:
            import pynvml
            
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            name = pynvml.nvmlDeviceGetName(handle)
            
            # Decodificar nome (diferente entre Python 2/3)
            if isinstance(name, bytes):
                name = name.decode('utf-8')
            
            memory_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
            temperature = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
            
            return {
                "name": name,
                "memory_total": memory_info.total // (1024 * 1024),  # MB
                "memory_free": memory_info.free // (1024 * 1024),    # MB
                "memory_used": memory_info.used // (1024 * 1024),    # MB
                "utilization_gpu": utilization.gpu,                   # %
                "utilization_memory": utilization.memory,             # %
                "temperature": temperature,                           # °C
                "count": self._gpu_count
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter informações da GPU: {e}")
            return None
    
    def get_vram_available(self) -> int:
        """Retorna VRAM disponível em MB"""
        if not self._pynvml_available:
            return 0
        
        try:
            import pynvml
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            memory_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            return memory_info.free // (1024 * 1024)
        except Exception:
            return 0
    
    def get_recommended_model_size(self) -> str:
        """Recomenda tamanho do modelo baseado na VRAM disponível"""
        vram = self.get_vram_available()
        
        if vram > 10000:  # > 10GB
            return "large-v3"
        elif vram > 6000:  # > 6GB
            return "medium"
        elif vram > 3000:  # > 3GB
            return "small"
        elif vram > 1500:  # > 1.5GB
            return "base"
        else:
            return "tiny"
    
    def shutdown(self):
        """Encerra PyNVML"""
        if self._pynvml_available:
            try:
                import pynvml
                pynvml.nvmlShutdown()
                logger.info("PyNVML encerrado")
            except Exception as e:
                logger.error(f"Erro ao encerrar PyNVML: {e}")
