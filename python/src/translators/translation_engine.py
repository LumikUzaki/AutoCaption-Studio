"""
Engine de Tradução - Suporte a múltiplos motores (Argos, MarianMT, NLLB)
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger('python-bridge.translation')


class TranslationEngine:
    """Engine unificada para tradução de texto"""
    
    def __init__(self, model_manager):
        self.model_manager = model_manager
        self._translators = {}
    
    def translate(
        self,
        text: str,
        source_lang: str = 'auto',
        target_lang: str = 'en',
        engine_name: str = 'argos'
    ) -> Dict[str, Any]:
        """
        Traduz texto
        
        Args:
            text: Texto para traduzir
            source_lang: Idioma de origem (ou 'auto')
            target_lang: Idioma de destino
            engine_name: Motor de tradução ('argos', 'marianmt', 'nllb')
        
        Returns:
            Dict com translated_text, source_language e engine
        """
        logger.info(f"Traduzindo com {engine_name}: {source_lang} → {target_lang}")
        
        try:
            if engine_name == 'argos':
                result = self._translate_argos(text, source_lang, target_lang)
            elif engine_name == 'marianmt':
                result = self._translate_marianmt(text, source_lang, target_lang)
            elif engine_name == 'nllb':
                result = self._translate_nllb(text, source_lang, target_lang)
            else:
                raise ValueError(f"Engine '{engine_name}' não suportada")
            
            logger.info(f"Tradução concluída")
            return result
            
        except Exception as e:
            logger.error(f"Erro na tradução: {str(e)}", exc_info=True)
            raise
    
    def _translate_argos(
        self,
        text: str,
        source_lang: str,
        target_lang: str
    ) -> Dict[str, Any]:
        """Tradução usando Argos Translate"""
        try:
            import argostranslate.package
            import argostranslate.translate
            
            # Garantir que pacotes estão instalados
            argostranslate.package.update_package_index()
            
            # Detectar idioma se necessário
            if source_lang == 'auto':
                from langdetect import detect
                source_lang = detect(text)
            
            # Traduzir
            translated = argostranslate.translate.translate(
                text,
                from_code=source_lang,
                to_code=target_lang
            )
            
            return {
                "translated_text": translated,
                "source_language": source_lang,
                "target_language": target_lang,
                "engine": "argos"
            }
            
        except ImportError:
            logger.warning("Argos Translate não disponível")
            raise RuntimeError("Argos Translate não está instalado")
        except Exception as e:
            logger.error(f"Erro no Argos: {str(e)}")
            raise
    
    def _translate_marianmt(
        self,
        text: str,
        source_lang: str,
        target_lang: str
    ) -> Dict[str, Any]:
        """Tradução usando MarianMT via Transformers"""
        try:
            from transformers import MarianMTModel, MarianTokenizer
            import torch
            
            # Mapear códigos de idioma para nomes de modelo
            model_name = f'Helsinki-NLP/opus-mt-{source_lang}-{target_lang}'
            
            logger.info(f"Carregando modelo MarianMT: {model_name}")
            
            # Carregar tokenizer e modelo
            tokenizer = MarianTokenizer.from_pretrained(model_name)
            model = MarianMTModel.from_pretrained(model_name)
            
            # Traduzir
            inputs = tokenizer(text, return_tensors="pt", padding=True)
            generated_ids = model.generate(**inputs)
            translated = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
            
            return {
                "translated_text": translated,
                "source_language": source_lang,
                "target_language": target_lang,
                "engine": "marianmt"
            }
            
        except ImportError:
            logger.warning("Transformers não disponível")
            raise RuntimeError("HuggingFace Transformers não está instalado")
        except Exception as e:
            logger.error(f"Erro no MarianMT: {str(e)}")
            raise
    
    def _translate_nllb(
        self,
        text: str,
        source_lang: str,
        target_lang: str
    ) -> Dict[str, Any]:
        """Tradução usando NLLB (No Language Left Behind) da Meta"""
        try:
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
            import torch
            
            # Modelo NLLB
            model_name = "facebook/nllb-200-distilled-600M"
            
            logger.info(f"Carregando modelo NLLB: {model_name}")
            
            # Mapear códigos de idioma para formato NLLB
            nllb_source = self._convert_to_nllb_code(source_lang)
            nllb_target = self._convert_to_nllb_code(target_lang)
            
            # Carregar tokenizer e modelo
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
            
            # Traduzir
            inputs = tokenizer(
                text,
                return_tensors="pt",
                src_lang=nllb_source
            )
            
            generated_ids = model.generate(
                **inputs,
                forced_bos_token_id=tokenizer.lang_code_to_id[nllb_target],
                max_length=512
            )
            
            translated = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
            
            return {
                "translated_text": translated,
                "source_language": source_lang,
                "target_language": target_lang,
                "engine": "nllb"
            }
            
        except ImportError:
            logger.warning("NLLB não disponível")
            raise RuntimeError("NLLB requer HuggingFace Transformers")
        except Exception as e:
            logger.error(f"Erro no NLLB: {str(e)}")
            raise
    
    def _convert_to_nllb_code(self, lang_code: str) -> str:
        """Converte código de idioma para formato NLLB"""
        nllb_mapping = {
            'pt': 'por_Latn',
            'en': 'eng_Latn',
            'es': 'spa_Latn',
            'fr': 'fra_Latn',
            'de': 'deu_Latn',
            'it': 'ita_Latn',
            'ru': 'rus_Cyrl',
            'ja': 'jpn_Jpan',
            'ko': 'kor_Hang',
            'zh': 'zho_Hans',
            'ar': 'arb_Arab',
            'hi': 'hin_Deva',
            'nl': 'nld_Latn',
            'pl': 'pol_Latn',
            'tr': 'tur_Latn'
        }
        return nllb_mapping.get(lang_code, f"{lang_code}_Latn")
    
    def translate_batch(
        self,
        texts: List[str],
        source_lang: str = 'auto',
        target_lang: str = 'en',
        engine_name: str = 'argos'
    ) -> Dict[str, Any]:
        """Traduz lote de textos"""
        logger.info(f"Traduzindo lote de {len(texts)} textos")
        
        results = []
        for i, text in enumerate(texts):
            try:
                result = self.translate(text, source_lang, target_lang, engine_name)
                results.append({
                    "index": i,
                    "original": text,
                    "translated": result["translated_text"],
                    "success": True
                })
            except Exception as e:
                results.append({
                    "index": i,
                    "original": text,
                    "error": str(e),
                    "success": False
                })
        
        return {
            "translations": results,
            "total": len(texts),
            "successful": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"]),
            "engine": engine_name
        }
    
    def get_supported_languages(self) -> List[Dict[str, str]]:
        """Retorna lista de idiomas suportados"""
        # Lista comum de idiomas suportados pela maioria dos engines
        languages = [
            {"code": "pt", "name": "Português"},
            {"code": "en", "name": "English"},
            {"code": "es", "name": "Español"},
            {"code": "fr", "name": "Français"},
            {"code": "de", "name": "Deutsch"},
            {"code": "it", "name": "Italiano"},
            {"code": "ru", "name": "Русский"},
            {"code": "ja", "name": "日本語"},
            {"code": "ko", "name": "한국어"},
            {"code": "zh", "name": "中文"},
            {"code": "ar", "name": "العربية"},
            {"code": "hi", "name": "हिन्दी"},
            {"code": "nl", "name": "Nederlands"},
            {"code": "pl", "name": "Polski"},
            {"code": "tr", "name": "Türkçe"},
            {"code": "sv", "name": "Svenska"},
            {"code": "da", "name": "Dansk"},
            {"code": "fi", "name": "Suomi"},
            {"code": "no", "name": "Norsk"},
            {"code": "cs", "name": "Čeština"},
            {"code": "el", "name": "Ελληνικά"},
            {"code": "he", "name": "עברית"},
            {"code": "th", "name": "ไทย"},
            {"code": "vi", "name": "Tiếng Việt"},
            {"code": "id", "name": "Bahasa Indonesia"}
        ]
        
        # Adicionar idiomas extras do NLLB (200+)
        nllb_extras = [
            {"code": "bn", "name": "বাংলা"},
            {"code": "ur", "name": "اردو"},
            {"code": "fa", "name": "فارسی"},
            {"code": "sw", "name": "Kiswahili"},
            {"code": "am", "name": "አማርኛ"},
            {"code": "yo", "name": "Yorùbá"},
            {"code": "ig", "name": "Igbo"},
            {"code": "ha", "name": "Hausa"}
        ]
        
        return languages + nllb_extras
