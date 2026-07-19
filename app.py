import asyncio
import edge_tts
from vosk import Model, KaldiRecognizer
import soundfile as sf
import re
import os
import json
import random
import requests
from flask import Flask, render_template_string, request, jsonify, session, send_file, send_from_directory
from googletrans import Translator
import pypinyin
import jieba
from pydub import AudioSegment
import io
import scipy.signal as signal
from deep_translator import GoogleTranslator

app = Flask(__name__)

# O Flask exige uma chave secreta para usar sessões criptografadas no navegador (Adicionado para a memória da IA)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "chave_secreta_padrao_muito_segura_123")

# Força Flask a usar a pasta atual para templates
app.template_folder = "."

# Configure sua chave da Groq
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "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")

# Inicializa tradutor
translator = Translator()

# Carrega dados
with open("vocabulary.json", "r", encoding="utf-8") as f:
    vocabulary = json.load(f)

with open("words_bank.json", "r", encoding="utf-8") as f:
    words_bank = json.load(f)

# Dicionário de cache modificado para separar por idioma de destino
translation_cache = {}

# ==================== ROTAS ====================

@app.route('/caracteres.json')
def serve_caracteres():
    return send_from_directory('.', 'caracteres.json')

@app.route("/")
def index():
    with open("index.html", "r", encoding="utf-8") as f:
        return render_template_string(f.read())

@app.route("/style.css")
def style():
    with open("style.css", "r", encoding="utf-8") as f:
        return f.read(), 200, {'Content-Type': 'text/css'}

@app.route("/script.js")
def script():
    with open("script.js", "r", encoding="utf-8") as f:
        return f.read(), 200, {'Content-Type': 'application/javascript'}


@app.route("/api/categories")
def get_categories():
    """Retorna todas as categorias disponíveis com contagem de palavras"""
    try:
        categorias_count = {}
        
        for word in vocabulary:
            for cat in word.get("categorias", []):
                categorias_count[cat] = categorias_count.get(cat, 0) + 1
        
        # Ordena por nome
        categorias_ordenadas = sorted(
            [{"nome": cat, "count": count} for cat, count in categorias_count.items()],
            key=lambda x: x["nome"]
        )
        
        print(f"Categorias encontradas: {len(categorias_ordenadas)}")
        
        return jsonify({
            "categories": categorias_ordenadas,
            "total": len(vocabulary)
        })
    except Exception as e:
        print(f"Erro em /api/categories: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/quiz")
def quiz():
    try:
        category = request.args.get("category", "todas")
        print(f"Recebida requisição quiz com categoria: {category}")
        
        # Filtra palavras pela categoria
        if category == "todas":
            filtered_vocab = vocabulary
        else:
            filtered_vocab = [w for w in vocabulary if category in w.get("categorias", [])]
        
        print(f"Palavras filtradas: {len(filtered_vocab)}")
        
        # Se não houver palavras na categoria, retorna todas
        if not filtered_vocab:
            filtered_vocab = vocabulary
        
        # Escolhe palavra correta
        correct = random.choice(filtered_vocab)
        
        # Escolhe distratores (preferencialmente da mesma categoria)
        distractors_pool = [w for w in filtered_vocab if w["id"] != correct["id"]]
        
        # Se não houver distratores suficientes na categoria, pega de todas
        if len(distractors_pool) < 3:
            print("Poucos distratores na categoria, usando pool completo")
            distractors_pool = [w for w in vocabulary if w["id"] != correct["id"]]
        
        # Garante que temos pelo menos 3 distratores
        if len(distractors_pool) >= 3:
            distractors = random.sample(distractors_pool, 3)
        else:
            # Se não houver 3 distratores, usa todos disponíveis
            distractors = distractors_pool
        
        # EXTRAI APENAS O TEXTO PORTUGUÊS - CORREÇÃO AQUI!
        options = [d["portuguese"] for d in distractors]  # <- Isso garante que são strings
        options.append(correct["portuguese"])  # <- Adiciona a correta como string
        random.shuffle(options)
        
        # Log para debug
        print(f"Opções finais: {options}")
        print(f"Correta: {correct['portuguese']}")
        
        response_data = {
            "chinese": correct["chinese"],
            "pinyin": correct["pinyin"],
            "options": options,  # <- Agora são strings garantidas
            "correct": correct["portuguese"]
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Erro em /api/quiz: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "chinese": "错误",
            "pinyin": "cuò wù",
            "options": ["erro", "falha", "problema", "tente novamente"],
            "correct": "tente novamente"
        })
print(len(vocabulary))


@app.route("/api/translate", methods=["GET"])
def translate():
    import urllib.parse
    import unicodedata

    raw_text = request.args.get("text", "").strip()
    
    try:
        text = urllib.parse.unquote(raw_text).replace("\n", " ").replace("\r", "")
    except Exception:
        text = raw_text.replace("\n", " ").replace("\r", "")

    source = request.args.get("source", "pt")
    target = request.args.get("target", "zh-cn")

    if not text:
        return jsonify({"translated": "", "pinyin": ""})

    is_pinyin_input = (source == "pinyin")

    # Tratamento para entrada em Pinyin (Mandarim -> PT-BR)
    if is_pinyin_input:
        actual_source = "auto"  # Deixa o Google detectar que é a fonética do Mandarim
        # Remove os acentos de tons para facilitar a leitura da API
        text_normalized = unicodedata.normalize('NFD', text)
        text_to_send = "".join([c for c in text_normalized if not unicodedata.combining(c)])
    else:
        actual_source = source
        text_to_send = text

    # O cache agora leva em conta a origem, o texto final e o destino correto
    cache_key = f"{actual_source}_{text_to_send}_{target}"
    
    if not is_pinyin_input and source == "zh-cn" and cache_key in translation_cache:
        return jsonify({"translated": translation_cache[cache_key], "pinyin": ""})

    try:
        # CORREÇÃO: Traduz o texto usando a origem (actual_source) e o destino (target) corretos!
        result = translator.translate(text_to_send, src=actual_source, dest=target)
        
        translated_text = str(result.text) if result and result.text else ""
        pinyin_text = ""

        # O Pinyin no bloco amarelo SÓ deve ser gerado se o destino final for Chinês (PT -> ZH)
        if target == "zh-cn":
            pinyin_list = pypinyin.pinyin(translated_text, style=pypinyin.Style.TONE)
            pinyin_text = " ".join([p[0] for p in pinyin_list])

        # Guarda no cache se for uma tradução direta por caracteres
        if not is_pinyin_input and source == "zh-cn":
            translation_cache[cache_key] = translated_text

        return jsonify({
            "translated": translated_text,
            "pinyin": pinyin_text
        })

    except Exception as e:
        print(f"Erro na rota de tradução corrigida: {e}")
        return jsonify({"translated": "Erro ao processar tradução.", "pinyin": ""})
    
# ==================== CONFIGURAÇÃO DO VOSK (STT) ====================
if os.path.exists("model-cn"):
    model = Model("model-cn")
else:
    model = None
    print("⚠️ ATENÇÃO: A pasta 'model-cn' não foi encontrada! O microfone não funcionará.")

@app.route("/api/stt", methods=["POST"])
def stt():
    if not model:
        return jsonify({"pinyin": "", "error": "Modelo desativado no servidor."}), 500

    if 'audio' not in request.files:
        return jsonify({"pinyin": "", "error": "Nenhum arquivo enviado"}), 400
        
    audio_file = request.files['audio']
    audio_path = "audio_usuario.wav"
    audio_file.save(audio_path)
    
    try:
        # 1. Lê o áudio gravado pelo navegador
        try:
            data, samplerate = sf.read(audio_path)
        except Exception as e_sf:
            print(f"Erro ao ler arquivo com SoundFile: {e_sf}")
            if os.path.exists(audio_path): os.remove(audio_path)
            return jsonify({"pinyin": "", "error": "Formato de áudio incompatível com o servidor local."})

        # 2. Se o áudio for estéreo (2 canais), transforma em Mono (1 canal)
        if len(data.shape) > 1:
            data = data.mean(axis=1)

        # 3. Faz a reamostragem matemática para 16000Hz caso venha diferente (evita voz distorcida)
        if samplerate != 16000:
            num_samples = int(len(data) * 16000 / samplerate)
            data = signal.resample(data, num_samples)

        # 4. Sobrescreve o arquivo no formato PCM_16 limpo a 16kHz
        sf.write(audio_path, data, 16000, subtype='PCM_16')
        
        # 5. Passa para o Vosk processar o áudio limpo
        wf = open(audio_path, "rb")
        rec = KaldiRecognizer(model, 16000)
        rec.SetWords(True)
        
        while True:
            data = wf.read(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                pass
                
        res_final = json.loads(rec.FinalResult())
        texto_chines = res_final.get("text", "").replace(" ", "")
        wf.close()
        
        if os.path.exists(audio_path):
            os.remove(audio_path)
            
        print(f"-> Vosk recebeu áudio limpo e reconheceu: {texto_chines}") 
        
        if not texto_chines or texto_chines.strip() == "":
            return jsonify({"pinyin": "", "error": "O servidor ouviu apenas silêncio. Fale mais perto do microfone."})
            
        pinyin_convertido = converter_para_pinyin_interno(texto_chines)
        return jsonify({"pinyin": pinyin_convertido, "chinese": texto_chines})

    except Exception as e:
        if os.path.exists(audio_path):
            os.remove(audio_path)
        print(f"Erro crítico no STT: {e}")
        return jsonify({"pinyin": "", "error": f"Erro no processamento: {str(e)}"}), 500

def converter_para_pinyin_interno(texto):
    # Transforma os caracteres em pinyin com acentos de tom (Ex: 你好 -> nǐ hǎo)
    lista_pinyin = pypinyin.pinyin(texto, style=pypinyin.Style.TONE)
    
    # CORRIGIDO: Variável correta mapeando os itens da lista
    frase_pinyin = " ".join([item[0] for item in lista_pinyin])
    return frase_pinyin

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_msg = data.get("message", "")
    # Captura o nível enviado pelo front-end (padrão 'Very Beginner' se falhar)
    user_level = data.get("level", "Very Beginner") 
    
    if not user_msg:
        return jsonify({"reply": "Por favor, digite uma mensagem."})

    # O prompt agora receberá o valor correto via .format() lá embaixo
    system_prompt = (
        """
You are a friendly native Chinese speaker from China named 灵犀 (Língxī).

You have to speak with a {classificacao} user who is learning Mandarin Chinese.

Your role is to have natural and engaging conversations with the user entirely in Mandarin Chinese.

Rules:
- Do not speak for too long. Keep your responses concise and to the point.
- Always reply in Simplified Chinese.
- Never use English, Portuguese, or any other language unless the user explicitly requests it.
- Speak like a real person in everyday life, using common and natural Chinese expressions.
- Keep the conversation friendly, casual, and interesting.
- Encourage the user to continue the conversation naturally.
- If the user makes mistakes in Chinese, politely correct them and then continue the conversation.
- Keep responses concise (1-5 sentences unless more detail is requested).
- Use Chinese characters only. Do not use pinyin unless the user asks for pronunciation.
- Do not explain grammar unless the user specifically asks.
- Act like a patient conversation partner helping the user improve their Mandarin through real communication.
- If the user say something in Portuguese,English, or any language other than Chinese, respond in their language but before you say something, tell , in their language, that you don´t kno how to speak thei language very well.
Your goal is to make the user feel like they are chatting with a native Chinese friend.
IMPORTANT: Avoid using "welcome to use Chinese" or "welcome to talk in Chinese." in the end of the phrase all the time.
"""
    ).format(classificacao=user_level) # Injeta dinamicamente o nível escolhido no input

    # --- INÍCIO DA LÓGICA DE MEMÓRIA ---
    if "chat_history" not in session:
        session["chat_history"] = []

    history = session["chat_history"]
    history.append({"role": "user", "content": user_msg})

    payload_messages = [{"role": "system", "content": system_prompt}] + history
    # --- FIM DA LÓGICA DE MEMÓRIA ---

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-oss-120b", # Modelo oficial rápido da Groq
                "messages": payload_messages,
                "temperature": 0.7,
                "max_tokens": 300
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            reply = result["choices"][0]["message"]["content"]
            
            # --- INÍCIO DA ATUALIZAÇÃO DA MEMÓRIA ---
            history.append({"role": "assistant", "content": reply})
            
            if len(history) > 20:
                history = history[-20:]
                
            session["chat_history"] = history
            session.modified = True
            # --- FIM DA ATUALIZAÇÃO DA MEMÓRIA ---

            words = list(jieba.cut(reply))
            return jsonify({"reply": reply, "words": words})
        else:
            return jsonify({"reply": f"Erro {response.status_code}: {response.text}"})
            
    except Exception as e:
        return jsonify({"reply": f"Erro na IA: {str(e)}"})


@app.route("/api/tts")
def tts():
    text = request.args.get("text", "")
    if not text:
        return "Texto vazio", 400

    # Remove os emojis também no Python usando Expressão Regular para garantir que o áudio fique limpo
    text_cleaned = re.sub(r'[\U00010000-\U0010ffff]', '', text).strip()
    
    if not text_cleaned:
        return "Texto apenas com emojis", 400

    output_filename = "resposta_ia.mp3"
    
    # Usando a voz 'zh-CN-XiaoxiaoNeural' (Voz feminina oficial da Microsoft, extremamente realista)
    communicate = edge_tts.Communicate(text_cleaned, "zh-CN-XiaoxiaoNeural")
    
    try:
        # Gera e salva o arquivo de áudio temporário no servidor
        asyncio.run(communicate.save(output_filename))
        return send_file(output_filename, mimetype="audio/mp3")
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/words-for-sentence")
def words_for_sentence():
    try:
        # Captura a dificuldade enviada pelo front-end (padrão 'medium' se não for enviada)
        difficulty = request.args.get("difficulty", "medium").lower()

        # Dicionário que altera as regras do prompt da IA com base na dificuldade escolhida
        dificuldades_config = {
            "super-easy": "A frase deve ser EXTREMAMENTE simples e curta, contendo exatamente entre 2 e 3 palavras (ex: 'Eu como arroz', 'Ele bebe água'). Use apenas sujeitos e verbos ultra-básicos.",
            "easy": "A frase deve ser simples e curta, contendo entre 3 e 4 palavras fáceis do dia a dia (ex: 'Eu gosto de café', 'Ela estuda muito').",
            "medium": "A frase deve ser comum no dia a dia, natural, contendo entre 4 e 6 palavras e tratando de situações cotidianas (ex: 'O professor bebe café de manhã', 'Eu vou ao mercado de ônibus').",
            "hard": "A frase deve ser um pouco mais elaborada, contendo entre 6 e 9 palavras, incluindo conectivos simples, expressões de tempo ou locais (ex: 'Ontem à noite eu fui ao restaurante com meus amigos e comi macarrão')."
        }

        # Fallbacks locais caso a IA sofra instabilidade ou timeout
        fallbacks = {
            "super-easy": "Eu como arroz.",
            "easy": "Eu gosto de café.",
            "medium": "O professor bebe café de manhã.",
            "hard": "Ontem à noite eu fui ao restaurante com meus amigos."
        }

        # Definição do fallback inicial
        regra_dificuldade = dificuldades_config.get(difficulty, dificuldades_config["medium"])
        frase_pt = fallbacks.get(difficulty, "O professor bebe café de manhã.")
        
        prompt_groq = (
            f"Escreva exatamente uma única frase em português do Brasil. "
            f"{regra_dificuldade} "
            f"A frase deve ser natural e comum no dia a dia. Não copie os exemplos. "
            f"Gere uma frase diferente a cada resposta. Não adicione explicações, comentários, aspas, "
            f"emojis, listas, numeração, títulos ou qualquer texto antes ou depois da frase. Retorne apenas a frase."
        )
        
        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt_groq}],
                    "temperature": 0.8,
                    "max_tokens": 80
                },
                timeout=5
            )
            
            if response.status_code == 200 and response.text:
                res_data = response.json()
                if res_data and "choices" in res_data and len(res_data["choices"]) > 0:
                    conteudo = res_data["choices"][0]["message"]["content"]
                    if conteudo:
                        frase_pt = conteudo.strip()
            else:
                print(f"⚠️ Groq retornou status {response.status_code} no jogo. Usando fallback.")
        except Exception as e_groq:
            print(f"⚠️ Erro ao tentar chamar a API da Groq: {e_groq}. Usando fallback.")

        # CORREÇÃO CRÍTICA: Utilizando o tradutor correto importado no topo do seu código (googletrans)
        try:
            res_zh = translator.translate(frase_pt, src='pt', dest='zh-cn')
            frase_zh = str(res_zh.text) if res_zh and res_zh.text else "老师早上喝咖啡"
        except Exception as e_trans:
            print(f"⚠️ Falha na tradução completa para o Chinês: {e_trans}")
            frase_zh = "老师早上喝咖啡"
            frase_pt = "O professor bebe café de manhã."

        # Limpa as pontuações para isolar só os ideogramas puristas nos blocos
        frase_zh_limpa = frase_zh.replace("。", "").replace("？", "").replace("，", "").replace(" ", "").strip()
        
        correct_order_objects = []
        
        # Cria a lista rica caractere por caractere
        for char in frase_zh_limpa:
            if not char.strip(): 
                continue
                
            # Pinyin nativo local
            resultado_pinyin = pypinyin.pinyin(char, style=pypinyin.Style.TONE)
            py_text = resultado_pinyin[0][0] if resultado_pinyin else ""
            
            # Traduz caractere individual para a dica do botão direito
            significado = "termo"
            try:
                res_pt = translator.translate(char, src='zh-cn', dest='pt')
                if res_pt and res_pt.text:
                    significado = str(res_pt.text)
            except:
                pass
            
            # Fallback inteligente se a API falhar no caractere avulso usando o vocabulário local
            if not significado or significado.lower() == "termo":
                significado = "termo"
                if 'vocabulary' in globals():
                    for word in vocabulary:
                        if word.get("chinese") == char:
                            significado = word.get("portuguese", "termo")
                            break

            correct_order_objects.append({
                "char": str(char),
                "pinyin": str(py_text),
                "translation": str(significado)
            })

        # Cria a versão embaralhada para a mecânica de arrastar do jogo
        shuffled_objects = correct_order_objects.copy()
        random.shuffle(shuffled_objects)
        
        return jsonify({
            "portuguese": frase_pt,
            "chinese_full": frase_zh,
            "correct_order": correct_order_objects,
            "shuffled_words": shuffled_objects
        })
        
    except Exception as e:
        print(f"❌ Erro crítico final na rota: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/dictionary-search")
def dictionary_search():
    """Busca palavras diretamente no vocabulary.json local"""
    query = request.args.get("q", "").strip().lower()
    if not query:
        return jsonify([])

    results = []
    for word in vocabulary:
        # Busca por correspondência no caractere chinês, no pinyin ou no português
        if (query in word.get("chinese", "").lower() or 
            query in word.get("pinyin", "").lower() or 
            query in word.get("portuguese", "").lower()):
            results.append(word)
            
        # Limita a 10 resultados na tela para não travar a interface
        if len(results) >= 10:
            break

    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True)
