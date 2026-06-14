// Cache de traduções
const wordCache = {};


// ---------- ABA QUIZ COM FILTROS ----------
let customQuizWords = []; 
let isCustomQuizActive = false; 
let currentCategory = 'todas';
let currentCorrect = '';
let quizInitialized = false;

// Função para carregar e exibir os filtros de categoria
async function loadCategoryFilters() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    
    const filtersDiv = document.getElementById('category-filters');
    filtersDiv.innerHTML = '';
    
    // Botão "Todas"
    const btnTodas = createFilterButton('todas', '📚 Todas', data.total);
    btnTodas.classList.add('active');
    filtersDiv.appendChild(btnTodas);
    
    // Botões para cada categoria
    data.categories.forEach(cat => {
      const btn = createFilterButton(cat.nome, getCategoryEmoji(cat.nome) + ' ' + capitalizeFirst(cat.nome), cat.count);
      filtersDiv.appendChild(btn);
    });
    
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
    // Fallback: carrega o quiz mesmo sem filtros
    loadQuiz();
  }
}

function createFilterButton(category, label, count) {
  const btn = document.createElement('button');
  btn.className = 'category-filter-btn';
  btn.innerHTML = `${label} <span class="category-count">${count}</span>`;
  
  btn.addEventListener('click', function() {
    // Remove active de todos
    document.querySelectorAll('.category-filter-btn').forEach(b => b.classList.remove('active'));
    // Adiciona active no clicado
    this.classList.add('active');
    // Atualiza categoria atual
    currentCategory = category;
    // Recarrega quiz
    loadQuiz();
  });
  
  return btn;
}

function getCategoryEmoji(categoria) {
  const emojis = {
    'cumprimento': '👋',
    'expressão': '💬',
    'bebida': '🥤',
    'animal': '🐾',
    'verbo': '⚡',
    'adjetivo': '✨',
    'família': '👨‍👩‍👧‍👦',
    'comida': '🍽️',
    'substantivo': '📦',
    'objeto': '🏠',
    'pronome': '👤',
    'preposição': '📍',
    'nacionalidade': '🗺️'
  };
  return emojis[categoria] || '📝';
}

function capitalizeFirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

async function loadQuiz() {
  try {
    let data;

    // SE O MODO PERSONALIZADO ESTIVER ATIVO
    if (isCustomQuizActive) {
      console.log('Carregando quiz personalizado...');
      
      if (customQuizWords.length < 4) {
        alert("O quiz personalizado precisa de pelo menos 4 palavras.");
        isCustomQuizActive = false;
        document.getElementById('btn-clear-custom-quiz').click();
        return;
      }

      // Escolhe uma palavra correta aleatória da lista personalizada
      const correctWord = customQuizWords[Math.floor(Math.random() * customQuizWords.length)];
      
      // Cria distratores a partir das outras palavras selecionadas pelo usuário
      const otherWords = customQuizWords.filter(w => w.chinese !== correctWord.chinese);
      
      // Embaralha os distratores e pega até 3
      const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
      const distractors = shuffledOthers.slice(0, 3);
      
      // Monta as opções de resposta (Português)
      const options = distractors.map(d => d.portuguese);
      options.append = correctWord.portuguese; // Fallback para manter o push histórico
      options.push(correctWord.portuguese);
      
      // Garante opções únicas e embaralhadas
      const uniqueOptions = [...new Set(options)].sort(() => 0.5 - Math.random());

      // Se por acaso faltar opção (ex: usuário escolheu palavras com traduções iguais)
      while (uniqueOptions.length < 4) {
        uniqueOptions.push("Opção Alternativa " + uniqueOptions.length);
      }

      data = {
        chinese: correctWord.chinese,
        pinyin: correctWord.pinyin,
        options: uniqueOptions,
        correct: correctWord.portuguese
      };

    } else {
      // MODO NORMAL: Busca filtros do servidor Flask
      console.log('Carregando quiz para categoria:', currentCategory);
      const res = await fetch(`/api/quiz?category=${encodeURIComponent(currentCategory)}`);
      data = await res.json();
    }
    
    console.log('Dados do Quiz atual:', data);
    
    // Atualiza palavra e pinyin na tela
    const wordElement = document.getElementById('quiz-word');
    const pinyinElement = document.getElementById('quiz-pinyin');
    
    wordElement.textContent = data.chinese;
    wordElement.style.color = ''; // Reset cor
    pinyinElement.textContent = data.pinyin;
    
    // Atualiza opções de botões
    const optsDiv = document.getElementById('quiz-options');
    optsDiv.innerHTML = '';
    
    data.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline-dark btn-lg mb-2';
      btn.textContent = opt;
      btn.addEventListener('click', function() {
        checkAnswer(opt, data.correct);
      });
      optsDiv.appendChild(btn);
    });
    
    document.getElementById('next-word').style.display = 'none';
    currentCorrect = data.correct;
    
  } catch (error) {
    console.error('Erro ao carregar quiz:', error);
    alert('Erro ao carregar palavras. Tente novamente.');
  }
}

function checkAnswer(selected, correct) {
  const wordElement = document.getElementById('quiz-word');
  const nextBtn = document.getElementById('next-word');
  
  // Desabilita todos os botões de opção
  const optionButtons = document.querySelectorAll('#quiz-options button');
  optionButtons.forEach(btn => {
    btn.disabled = true;
    
    // Destaca visualmente a resposta correta e a errada
    if (btn.textContent === correct) {
      btn.classList.remove('btn-outline-dark');
      btn.classList.add('btn-success');
    } else if (btn.textContent === selected && selected !== correct) {
      btn.classList.remove('btn-outline-dark');
      btn.classList.add('btn-danger');
    }
  });
  
  if (selected === correct) {
    // Feedback visual positivo
    wordElement.style.color = '#28a745';
  } else {
    // Feedback visual negativo
    wordElement.style.color = '#dc3545';
  }
  
  // Mostra botão próxima
  nextBtn.style.display = 'inline-block';
  nextBtn.textContent = 'Próxima ➤';
}

// Configura o botão "Próxima" UMA ÚNICA VEZ
function setupNextButton() {
  const nextBtn = document.getElementById('next-word');
  
  // Remove listeners anteriores para evitar duplicação
  const newNextBtn = nextBtn.cloneNode(true);
  nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
  
  newNextBtn.addEventListener('click', function() {
    console.log('Botão próxima clicado');
    loadQuiz();
  });
}

// Inicialização quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
  console.log('Inicializando Quiz com Filtros');
  
  // Configura botão próxima
  setupNextButton();
  
  // Carrega filtros e primeiro quiz
  loadCategoryFilters().then(() => {
    loadQuiz();
  });
  
  // Também inicializa quando a aba é mostrada (caso não seja a primeira)
  document.getElementById('quiz-tab').addEventListener('shown.bs.tab', function() {
    if (!quizInitialized) {
      loadQuiz();
      quizInitialized = true;
    }
  });
});

// ---------- ABA TRADUTOR BIDIRECIONAL ----------
let currentSourceLang = 'pt';
let currentTargetLang = 'zh-cn';
let mandarinInputType = 'characters'; // Controla o modo selecionado: 'characters' ou 'pinyin'

// Criamos o container dos botões com estilo moderno de "Abas Alternáveis"
const inputTypeContainer = document.createElement('div');
inputTypeContainer.id = 'mandarin-type-selector';
inputTypeContainer.className = 'mb-3 p-1';
inputTypeContainer.style.setProperty('display', 'none', 'important'); // Força a começar escondido de verdade
inputTypeContainer.style.backgroundColor = '#f1f3f5';
inputTypeContainer.style.borderRadius = '30px';
inputTypeContainer.style.border = '1px solid #e9ecef';

// Função utilitária para aplicar os estilos visuais de estado ativo/inativo
function styleSelectorButton(btn, isActive) {
  btn.type = 'button';
  btn.style.border = 'none';
  btn.style.padding = '8px 18px';
  btn.style.borderRadius = '20px';
  btn.style.fontSize = '14px';
  btn.style.fontWeight = '600';
  btn.style.cursor = 'pointer';
  btn.style.transition = 'all 0.2s ease-in-out';
  
  if (isActive) {
    btn.style.backgroundColor = '#212529'; // Cor escura moderna para o botão ativo
    btn.style.color = '#ffffff';
    btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.15)';
  } else {
    btn.style.backgroundColor = 'transparent';
    btn.style.color = '#495057'; // Tom de cinza agradável para o inativo
    btn.style.boxShadow = 'none';
  }
}

// Botão de Caracteres
const btnChars = document.createElement('button');
btnChars.textContent = 'Caracteres (汉字) "Recomendado"';
styleSelectorButton(btnChars, true); // Começa ativo

btnChars.onclick = () => {
  mandarinInputType = 'characters';
  styleSelectorButton(btnChars, true);
  styleSelectorButton(btnPinyin, false);
  document.getElementById('input-text').placeholder = 'Digite os caracteres chineses aqui...';
};

// Botão de Pinyin
const btnPinyin = document.createElement('button');
btnPinyin.textContent = 'Pinyin (nǐ hǎo)';
styleSelectorButton(btnPinyin, false); // Começa inativo

btnPinyin.onclick = () => {
  mandarinInputType = 'pinyin';
  styleSelectorButton(btnPinyin, true);
  styleSelectorButton(btnChars, false);
  document.getElementById('input-text').placeholder = 'Digite o pinyin aqui... Ex: wo xiang ni';
};

// Adiciona os botões ao container arredondado
inputTypeContainer.appendChild(btnChars);
inputTypeContainer.appendChild(btnPinyin);

// Injeta os botões na página logo acima da caixa de texto
const textInputBox = document.getElementById('input-text');
if (textInputBox && textInputBox.parentNode) {
  textInputBox.parentNode.insertBefore(inputTypeContainer, textInputBox);
}

// Evento para alternar a direção da tradução (Inversor)
document.getElementById('swap-lang-btn').addEventListener('click', () => {
  const labelSource = document.getElementById('label-source');
  const labelTarget = document.getElementById('label-target');
  const labelInputBox = document.getElementById('label-input-box');
  const inputBox = document.getElementById('input-text');

  // Inverte as variáveis de controle
  if (currentSourceLang === 'pt') {
    currentSourceLang = 'zh-cn';
    currentTargetLang = 'pt';
    
    // Atualiza a interface visual
    labelSource.textContent = 'Mandarim';
    labelTarget.textContent = 'Português';
    labelInputBox.textContent = 'Texto em Mandarim:';
    inputBox.placeholder = 'Digite os caracteres chineses aqui...';

    // MOSTRA apenas quando vai de Mandarim para Português
    inputTypeContainer.style.setProperty('display', 'inline-flex', 'important');
    mandarinInputType = 'characters';
    styleSelectorButton(btnChars, true);
    styleSelectorButton(btnPinyin, false);
  } else {
    currentSourceLang = 'pt';
    currentTargetLang = 'zh-cn';
    
    // Volta ao padrão original
    labelSource.textContent = 'Português';
    labelTarget.textContent = 'Mandarim';
    labelInputBox.textContent = 'Texto em Português:';
    inputBox.placeholder = 'Digite algo...';

    // ESCONDE de forma absoluta quando volta para Português -> Mandarim
    inputTypeContainer.style.setProperty('display', 'none', 'important');
  }

  // Limpa os resultados anteriores para não confundir o usuário
  document.getElementById('translation-container').style.display = 'none';
  inputBox.value = '';
});

// Evento de disparo da tradução
document.getElementById('translate-btn').addEventListener('click', async () => {
  const text = document.getElementById('input-text').value.trim();
  const container = document.getElementById('translation-container');
  const resultDiv = document.getElementById('translation-result');
  const pinyinContainer = document.getElementById('pinyin-container');
  const pinyinDiv = document.getElementById('translation-pinyin');

  if (!text) return;

  resultDiv.textContent = 'Traduzindo...';
  pinyinDiv.textContent = '';
  pinyinContainer.style.display = 'none';
  container.style.display = 'block';

  try {
    let sourceParam = currentSourceLang;
    if (currentSourceLang === 'zh-cn' && mandarinInputType === 'pinyin') {
      sourceParam = 'pinyin'; 
    }

    const url = `/api/translate?text=${encodeURIComponent(text)}&source=${sourceParam}&target=${currentTargetLang}`;
    const res = await fetch(url);
    const data = await res.json();

    resultDiv.textContent = data.translated;

    if (currentTargetLang === 'zh-cn' && data.pinyin) {
      pinyinDiv.textContent = data.pinyin;
      pinyinContainer.style.display = 'block';
    } else {
      pinyinContainer.style.display = 'none';
    }

  } catch (error) {
    console.error("Erro na requisição do tradutor:", error);
    resultDiv.textContent = 'Erro de comunicação com o servidor.';
  }
});
// ---------- ABA THE CALL (chat) ----------
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const chatLevel = document.getElementById('chat-level'); // 👉 Captura o novo elemento select

document.getElementById('send-chat').addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  
  // 👉 Captura o nível selecionado no momento do envio (Very Beginner, Beginner, etc.)
  const level = chatLevel ? chatLevel.value : 'Very Beginner'; 

  addMessage('user', msg);
  chatInput.value = '';

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    // 👉 Enviamos a mensagem E o nível selecionado para o Python
    body: JSON.stringify({
      message: msg,
      level: level 
    })
  });
  
  const data = await res.json();
  addMessage('bot', data.reply, data.words);
}

// Função auxiliar para renderizar os caracteres clicáveis dentro do balão
function renderChineseCharacters(targetElement, rawText) {
  targetElement.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (let char of rawText) {
    if (/[\u4e00-\u9fff]/.test(char)) {
      const span = document.createElement('span');
      span.className = 'clickable-word';
      span.textContent = char;
      span.dataset.word = char;
      span.addEventListener('click', showTranslation);
      fragment.appendChild(span);
    } else {
      fragment.appendChild(document.createTextNode(char));
    }
  }
  targetElement.appendChild(fragment);
}

function addMessage(role, text, words = null) {
  const row = document.createElement('div');
  row.className = `d-flex align-items-start mb-2 ${role === 'user' ? 'justify-content-end' : 'justify-content-start'}`;

  const div = document.createElement('div');
  div.className = `p-2 rounded ${role === 'user' ? 'bg-primary text-white' : 'bg-white border'}`;
  div.style.maxWidth = '75%';

  div.dataset.originalText = text;

  if (role === 'bot' && words) {
    renderChineseCharacters(div, text);
    
    // Fala o texto em mandarim automaticamente assim que aparece na tela
    falarTextoMandarim(text);
  } else {
    div.textContent = text;
  }


  row.appendChild(div);

  if (role === 'bot') {
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group-vertical btn-group-sm ms-2';
    
    // 👉 NOVO: Botão de Áudio para repetir a fala
    const btnAudio = document.createElement('button');
    btnAudio.className = 'btn btn-outline-info py-0 px-1 font-monospace mb-1';
    btnAudio.style.fontSize = '10px';
    btnAudio.innerHTML = '🔊';
    btnAudio.title = 'Ouvir pronúncia';
    btnAudio.onclick = () => {
      // Sempre lê o texto original em chinês armazenado no dataset
      falarTextoMandarim(div.dataset.originalText);
    };
    btnGroup.appendChild(btnAudio);

    // Botão PT-BR (Seu código original mantido)
    const btnPt = document.createElement('button');
    btnPt.className = 'btn btn-outline-success py-0 px-1 font-monospace';
    btnPt.style.fontSize = '10px';
    btnPt.textContent = 'PT-BR';
    btnPt.title = 'Traduzir para Português';
    
    btnPt.onclick = async () => {
      if (div.dataset.translatedText) {
        if (div.textContent === div.dataset.translatedText) {
          renderChineseCharacters(div, div.dataset.originalText);
        } else {
          div.textContent = div.dataset.translatedText;
        }
        return;
      }
      
      btnPt.textContent = '...';
      try {
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&source=zh-cn&target=pt`);
        const data = await res.json();
        
        if (data.translated && data.translated !== "Erro ao traduzir dados.") {
          div.dataset.translatedText = data.translated;
          div.textContent = data.translated;
        } else {
          div.textContent = "Tradução indisponível temporariamente.";
        }
      } catch (err) {
        console.error("Erro na tradução total do chat:", err);
        div.textContent = "Erro de rede ao traduzir.";
      } finally {
        btnPt.textContent = 'PT-BR';
      }
    };

    // Botão Pinyin (Seu código original mantido)
    const btnPy = document.createElement('button');
    btnPy.className = 'btn btn-outline-warning py-0 px-1 font-monospace mt-1 text-dark';
    btnPy.style.fontSize = '10px';
    btnPy.textContent = 'Pinyin';
    btnPy.title = 'Converter para Pinyin';

    btnPy.onclick = async () => {
      if (div.dataset.pinyinText) {
        if (div.textContent === div.dataset.pinyinText) {
          renderChineseCharacters(div, div.dataset.originalText);
        } else {
          div.textContent = div.dataset.pinyinText;
        }
        return;
      }

      btnPy.textContent = '...';
      try {
        const res = await fetch(`/api/translate?text=${encodeURIComponent(text)}&source=zh-cn&target=zh-cn`);
        const data = await res.json();
        div.dataset.pinyinText = data.pinyin;
        div.textContent = data.pinyin;
      } catch (err) {
        console.error("Erro ao gerar Pinyin:", err);
        div.textContent = "Erro ao carregar Pinyin.";
      } finally {
        btnPy.textContent = 'Pinyin';
      }
    };

    btnGroup.appendChild(btnPt);
    btnGroup.appendChild(btnPy);
    row.appendChild(btnGroup);
  }

  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function showTranslation(e) {
  const word = e.target.dataset.word;
  if (wordCache[word]) {
    displayPopover(e.target, wordCache[word]);
    return;
  }
  const res = await fetch(`/api/translate?text=${encodeURIComponent(word)}&source=zh-cn&target=pt`);
  const data = await res.json();
  wordCache[word] = data.translated;
  displayPopover(e.target, data.translated);
}

function displayPopover(element, translation) {
  const old = document.querySelector('.translation-popover');
  if (old) old.remove();

  const pop = document.createElement('div');
  pop.className = 'translation-popover';
  pop.textContent = translation;
  const rect = element.getBoundingClientRect();
  pop.style.left = rect.left + window.scrollX + 'px';
  pop.style.top = (rect.top + window.scrollY - 30) + 'px';
  document.body.appendChild(pop);
  setTimeout(() => { if(pop.parentNode) pop.remove(); }, 2000);
}

// Remove popover ao clicar fora
document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('clickable-word')) {
    const pop = document.querySelector('.translation-popover');
    if (pop) pop.remove();
  }
});

// ---------- NOVO SISTEMA DE MICROFONE VIA BACKEND (GRAVAÇÃO PURA) ----------
let mediaRecorder = null;
let audioChunks = [];
let gravandoVoz = false;

async function alternarMicrofone() {
  const micBtn = document.getElementById('mic-chat');
  
  if (gravandoVoz) {
    mediaRecorder.stop();
    gravandoVoz = false;
    if(micBtn) { micBtn.className = 'btn btn-outline-secondary'; micBtn.innerHTML = '🎤︎︎'; }
    return;
  }

  try {
    // CAPTURA PADRÃO: Sem forçar taxas de amostragem que travam o navegador
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      // Envia o tipo nativo gravado pelo sistema (geralmente audio/webm ou audio/ogg)
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      
      chatInput.value = "...Processando sua voz no servidor...";

      const formData = new FormData();
      formData.append('audio', audioBlob, 'gravacao.wav');

      try {
        const res = await fetch('/api/stt', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.pinyin) {
          chatInput.value = data.pinyin;
          sendMessage(); 
        } else {
          chatInput.value = "";
          alert(data.error || "Erro ao reconhecer áudio.");
        }
      } catch (err) {
        console.error("Erro no envio do áudio:", err);
        chatInput.value = "";
      }
    };

    mediaRecorder.start();
    gravandoVoz = true;
    if(micBtn) { micBtn.className = 'btn btn-danger'; micBtn.innerHTML = '🛑 Gravando... Fale e clique para finalizar'; }

  } catch (err) {
    console.error("Erro real do navegador ao acessar microfone:", err);
    alert("O navegador bloqueou o microfone. Tente recarregar a página ou reativar a permissão no cadeado.");
  }
}

document.getElementById('mic-chat')?.addEventListener('click', alternarMicrofone);

// ---------- CONFIGURAÇÃO DA SÍNTESE DE VOZ ULTRA-REALISTA (TTS VIA BACKEND) ----------
function falarTextoMandarim(texto) {
  if (!texto) return;

  // Monta a URL apontando para a nova rota que você criou no Python
  const url = `/api/tts?text=${encodeURIComponent(texto)}`;

  // Cria o objeto de áudio do HTML e toca
  const audio = new Audio(url);
  
  audio.play().catch(error => {
    console.error("Erro ao reproduzir o áudio neural do servidor:", error);
  });
}

// ---------- ABA FRASES (CHINÊS SEMPRE / HOVER PINYIN / DIREITO PT-BR) ----------

let correctSentenceOrder = [];


async function loadWordsForSentence() {

  const buildArea = document.getElementById('sentence-build-area');

  const poolArea = document.getElementById('word-pool-area');

  const targetTrans = document.getElementById('target-translation');

  

  // Garante que os containers existam antes de limpar

  if (buildArea) buildArea.innerHTML = '';

  if (poolArea) poolArea.innerHTML = '';

  if (targetTrans) targetTrans.textContent = 'Carregando...';


  try {

    const res = await fetch('/api/words-for-sentence');

    const data = await res.json();

    

    if (data.error) {

      if (targetTrans) targetTrans.textContent = "Erro ao carregar frase.";

      return;

    }


    // Alimenta a frase em português do topo

    if (targetTrans) targetTrans.textContent = data.portuguese;

    

    // Mapeia a ordem correta guardando apenas os caracteres puros para a validação final

    correctSentenceOrder = data.correct_order.map(item => item.char);


    // Processa a lista de objetos embaralhados gerados pelo Python

    data.shuffled_words.forEach(wordObj => {

      const btn = document.createElement('div');

      btn.className = 'duo-word';

      btn.textContent = wordObj.char; // Printa o caractere chinês no quadrado


      // Define o Pinyin no atributo para o efeito de hover do CSS

      btn.setAttribute('data-pinyin', wordObj.pinyin);


      // Bloqueia o menu de contexto nativo do navegador

      btn.addEventListener('contextmenu', (e) => e.preventDefault());


      // Clique com botão direito (mousedown com e.button === 2): Mostra balão de tradução isolada

      btn.addEventListener('mousedown', (e) => {

        if (e.button === 2) {

          showPopupDica(btn, wordObj.translation);

        }

      });


      // Soltar o clique ou arrastar o mouse para fora remove o balão da dica

      btn.addEventListener('mouseup', (e) => {

        if (e.button === 2) removePopupDica();

      });

      btn.addEventListener('mouseleave', () => {

        removePopupDica();

      });


      // Clique com botão esquerdo (e.button === 0): Move o quadrado de área

      btn.addEventListener('click', (e) => {

        if (e.button === 0) {

          if (btn.parentElement.id === 'word-pool-area') {

            if (buildArea) buildArea.appendChild(btn);

          } else {

            if (poolArea) poolArea.appendChild(btn);

          }

        }

      });

      

      if (poolArea) poolArea.appendChild(btn);

    });


  } catch (err) {

    console.error("Erro na renderização do Front-end:", err);

    if (targetTrans) targetTrans.textContent = "Erro de conexão com o servidor.";

  }

}


function showPopupDica(element, texto) {

  removePopupDica();

  

  const pop = document.createElement('div');

  pop.className = 'duo-dica-popup';

  pop.textContent = texto;

  

  document.body.appendChild(pop);

  

  const rect = element.getBoundingClientRect();

  pop.style.left = (rect.left + window.scrollX + (rect.width / 2) - (pop.offsetWidth / 2)) + 'px';

  pop.style.top = (rect.top + window.scrollY - pop.offsetHeight - 8) + 'px';

}


function removePopupDica() {

  const oldPop = document.querySelector('.duo-dica-popup');

  if (oldPop) oldPop.remove();

}


// Nova função para mostrar o resultado com canvas
function showResultCanvas(isCorrect, correctAnswer = '') {
  // Remove qualquer canvas existente
  const existingCanvas = document.querySelector('.result-overlay');
  if (existingCanvas) existingCanvas.remove();

  // Cria o overlay
  const overlay = document.createElement('div');
  overlay.className = 'result-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  `;

  // Cria o canvas/container do resultado
  const resultBox = document.createElement('div');
  resultBox.className = 'result-box';
  resultBox.style.cssText = `
    background: white;
    border-radius: 20px;
    padding: 40px;
    text-align: center;
    min-width: 300px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease;
  `;

  if (isCorrect) {
    // Template para acerto
    resultBox.innerHTML = `
      <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
      <div style="font-size: 28px; font-weight: bold; color: #58CC02; margin-bottom: 20px;">
        Muito bem!
      </div>
      <button class="continue-btn" style="
        background: #58CC02;
        color: white;
        border: none;
        padding: 15px 40px;
        border-radius: 30px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
      ">Continuar</button>
    `;

    // Adiciona evento ao botão continuar
    setTimeout(() => {
      const continueBtn = resultBox.querySelector('.continue-btn');
      if (continueBtn) {
        continueBtn.addEventListener('click', () => {
          overlay.remove();
          loadWordsForSentence();
        });
      }
    }, 0);

  } else {
    // Template para erro
    resultBox.innerHTML = `
      <div style="font-size: 60px; margin-bottom: 20px;">⟳</div>
      <div style="font-size: 28px; font-weight: bold; color: #FF4B4B; margin-bottom: 30px;">
        Tente novamente
      </div>
      <div class="reveal-answer" style="
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
        color: #666;
        font-size: 16px;
        margin-bottom: 10px;
        padding: 10px;
        border-radius: 10px;
        transition: background 0.2s;
      ">
        <span>👁️</span>
        
      </div>
      <div class="correct-answer" style="
        display: none;
        background: #F0F0F0;
        padding: 15px;
        border-radius: 10px;
        margin: 20px 0;
        font-size: 20px;
        color: #333;
        letter-spacing: 2px;
      ">${correctAnswer}</div>
      <button class="try-again-btn" style="
        background: #FF4B4B;
        color: white;
        border: none;
        padding: 15px 40px;
        border-radius: 30px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 20px;
      ">Tentar novamente</button>
    `;

    // Adiciona eventos
    setTimeout(() => {
      const revealBtn = resultBox.querySelector('.reveal-answer');
      const correctAnswerDiv = resultBox.querySelector('.correct-answer');
      const tryAgainBtn = resultBox.querySelector('.try-again-btn');

      if (revealBtn && correctAnswerDiv) {
        revealBtn.addEventListener('click', () => {
          correctAnswerDiv.style.display = 'block';
          revealBtn.style.display = 'none';
        });

        // Hover effect
        revealBtn.addEventListener('mouseenter', () => {
          revealBtn.style.background = '#F0F0F0';
        });
        revealBtn.addEventListener('mouseleave', () => {
          revealBtn.style.background = 'transparent';
        });
      }

      if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', () => {
          overlay.remove();
        });

        // Hover effect
        tryAgainBtn.addEventListener('mouseenter', () => {
          tryAgainBtn.style.transform = 'scale(1.05)';
        });
        tryAgainBtn.addEventListener('mouseleave', () => {
          tryAgainBtn.style.transform = 'scale(1)';
        });
      }
    }, 0);
  }

  // Adiciona animações CSS se não existirem
  if (!document.getElementById('result-animations')) {
    const style = document.createElement('style');
    style.id = 'result-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { 
          opacity: 0;
          transform: translateY(20px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  overlay.appendChild(resultBox);
  document.body.appendChild(overlay);

  // Fecha ao clicar fora do box
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}


// Lógica de verificação da resposta do usuário
const checkBtn = document.getElementById('check-sentence-btn');
if (checkBtn) {
  checkBtn.addEventListener('click', () => {
    const buildArea = document.getElementById('sentence-build-area');
    if (!buildArea) return;
    
    const userOrder = Array.from(buildArea.children).map(btn => btn.textContent.trim());
    
    const userString = userOrder.join('');
    const correctString = correctSentenceOrder.join('');
    
    if (userString === correctString) {
      showResultCanvas(true);
    } else {
      showResultCanvas(false, correctString);
    }
  });
}


const newWordsBtn = document.getElementById('new-words-btn');
if (newWordsBtn) {
  newWordsBtn.addEventListener('click', loadWordsForSentence);
}


// Executa a carga inicial da função
loadWordsForSentence();

// ---------- DICIONÁRIO LOCAL AUTOMÁTICO ----------
const dictSearchBtn = document.getElementById('dict-search-btn');
const dictSearchInput = document.getElementById('dict-search-input');

if (dictSearchBtn && dictSearchInput) {
  dictSearchBtn.addEventListener('click', searchLocalDictionary);
  dictSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchLocalDictionary();
  });
}

async function searchLocalDictionary() {
  const query = dictSearchInput.value.trim();
  const resultsContainer = document.getElementById('dict-results');
  
  if (!query) return;
  
  resultsContainer.style.display = 'block';
  resultsContainer.innerHTML = `
    <div class="text-center py-2">
      <div class="spinner-border spinner-border-sm text-dark" role="status"></div>
      <span class="ms-2 text-muted small">Buscando no banco de dados...</span>
    </div>
  `;
  
  try {
    const res = await fetch(`/api/dictionary-search?q=${encodeURIComponent(query)}`);
    const words = await res.json();
    
    if (words.length === 0) {
      resultsContainer.innerHTML = `
        <div class="alert alert-warning mb-0 small">
          Nenhuma palavra encontrada para "<strong>${query}</strong>" no banco atual.
        </div>`;
      return;
    }
    
    // Monta a lista de cards com layout limpo e direto
    let html = '<div class="d-flex flex-column gap-2">';
    
    words.forEach(word => {
      // Formata as tags de categoria
      const categorias = word.categorias ? word.categorias.map(c => `<span class="badge bg-secondary me-1 text-capitalize">${c}</span>`).join('') : '';
      
      html += `
        <div class="p-3 bg-white border rounded shadow-sm d-flex align-items-center justify-content-between">
          <div>
            <span class="fs-2 fw-bold text-dark me-2">${word.chinese}</span>
            <span class="fs-5 text-muted font-monospace">[ ${word.pinyin} ]</span>
            <div class="mt-1 text-secondary fs-5">
              <strong>Significado:</strong> ${word.portuguese}
            </div>
          </div>
          <div class="text-end">
            ${categorias}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    resultsContainer.innerHTML = html;
    
  } catch (error) {
    console.error("Erro ao pesquisar no dicionário local:", error);
    resultsContainer.innerHTML = `<div class="alert alert-danger small mb-0">Erro ao carregar dados locais.</div>`;
  }
}

// Simulação da resposta da sua API
fetch('/api/words-for-sentence')
    .then(response => response.json())
    .then(data => {
        
        // Mostra a frase em português para o usuário traduzir
        document.getElementById("frase-alvo").innerText = data.portuguese;
        
        const container = document.getElementById("area-dos-blocos");
        container.innerHTML = ""; // Limpa a área
        
        // Cria os blocos embaralhados
        data.shuffled_words.forEach(item => {
            const botao = document.createElement("button");
            botao.className = "bloco-chines";
            botao.innerText = item.char; // Mostra o ideograma (Ex: 我)
            
            // MÁGICA 1: O HOVER DO PINYIN
            // O atributo 'title' faz o navegador mostrar uma caixinha amarela nativa ao passar o mouse
            botao.title = item.pinyin; 
            
            // MÁGICA 2: A TRADUÇÃO NO CLIQUE DIREITO
            botao.addEventListener("contextmenu", function(event) {
                event.preventDefault(); // Impede de abrir aquele menu chato do Windows
                
                // Aqui você pode disparar um alerta, ou abrir um modal bonito no seu app!
                alert(`Significado isolado: ${item.translation}`);
            });
            
            // Adiciona o botão na tela
            container.appendChild(botao);
        });
    });

    // Função para buscar palavras locais e exibir como sugestão para o Quiz
document.getElementById('search-custom-word')?.addEventListener('input', async function() {
  const query = this.value.trim();
  const resultsDiv = document.getElementById('custom-search-results');
  
  if (query.length < 1) {
    resultsDiv.innerHTML = '';
    return;
  }
  
  try {
    const res = await fetch(`/api/dictionary-search?q=${encodeURIComponent(query)}`);
    const words = await res.json();
    
    resultsDiv.innerHTML = '';
    words.forEach(word => {
      // Ignora se a palavra já estiver selecionada
      if (customQuizWords.some(w => w.chinese === word.chinese)) return;

      const badge = document.createElement('span');
      badge.className = 'badge bg-secondary p-2 style-pointer';
      badge.style.cursor = 'pointer';
      badge.innerHTML = `${word.chinese} (${word.portuguese}) +`;
      
      badge.addEventListener('click', () => {
        addWordToCustomQuiz(word);
        resultsDiv.innerHTML = '';
        document.getElementById('search-custom-word').value = '';
      });
      
      resultsDiv.appendChild(badge);
    });
  } catch (err) {
    console.error("Erro na busca de palavras customizadas:", err);
  }
});

function addWordToCustomQuiz(word) {
  if (customQuizWords.some(w => w.chinese === word.chinese)) return;
  
  customQuizWords.push(word);
  renderCustomSelectedWords();
}

function removeWordFromCustomQuiz(chinese) {
  customQuizWords = customQuizWords.filter(w => w.chinese !== chinese);
  renderCustomSelectedWords();
  
  if (customQuizWords.length < 4 && isCustomQuizActive) {
    document.getElementById('btn-clear-custom-quiz').click();
  }
}

function renderCustomSelectedWords() {
  const container = document.getElementById('custom-selected-words');
  const countSpan = document.getElementById('custom-count');
  const startBtn = document.getElementById('btn-start-custom-quiz');
  
  container.innerHTML = '';
  countSpan.textContent = `${customQuizWords.length} selecionadas`;
  
  customQuizWords.forEach(word => {
    const badge = document.createElement('span');
    badge.className = 'badge bg-success p-2';
    badge.innerHTML = `${word.chinese} <span style="cursor:pointer; font-weight:bold; margin-left:5px;">×</span>`;
    
    badge.querySelector('span').addEventListener('click', () => {
      removeWordFromCustomQuiz(word.chinese);
    });
    
    container.appendChild(badge);
  });
  
  // Ativa o botão apenas se tiver 4 ou mais palavras selecionadas
  startBtn.disabled = customQuizWords.length < 4;
}

// Evento do botão de Iniciar Quiz Customizado
document.getElementById('btn-start-custom-quiz')?.addEventListener('click', function() {
  isCustomQuizActive = true;
  document.getElementById('btn-clear-custom-quiz').style.display = 'inline-block';
  
  // Remove marcação ativa dos botões de categorias padrões
  document.querySelectorAll('.category-filter-btn').forEach(b => b.classList.remove('active'));
  
  loadQuiz();
});

// Evento de Voltar ao Normal
document.getElementById('btn-clear-custom-quiz')?.addEventListener('click', function() {
  isCustomQuizActive = false;
  this.style.display = 'none';
  
  // Força o reset para a categoria "todas"
  currentCategory = 'todas';
  const btnTodas = document.querySelector('.category-filter-btn');
  if (btnTodas) btnTodas.classList.add('active');
  
  loadQuiz();
});

// ========== ABA 5: CALIGRAFIA (COM BUSCA INTELIGENTE E PRECISÃO CORRIGIDA) ==========
class CalligraphyCanvas {
  constructor() {
    this.canvas = document.getElementById('calligraphy-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.isDrawing = false;
    this.showGuide = true;
    this.baseBrushSize = 8;
    this.currentBrushSize = 8;
    this.strokes = [];
    this.currentStroke = [];
    this.selectedChar = null;
    this.charData = null;
    this.searchInput = document.getElementById('char-search-input');
    this.suggestionsList = document.getElementById('char-suggestions');
    this.allCharacters = [];
    this.init();
  }

  init() {
    this.setupCanvas();
    this.loadCharacters();
    this.setupPointerEvents();
    this.setupButtonEvents();
    this.setupSearch();            // ativa a busca inteligente
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  setupCanvas() {
    this.canvas.style.touchAction = 'none';
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const size = Math.min(container.clientWidth, 500);
    this.canvas.width = size * 2;
    this.canvas.height = size * 2;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(2, 2);
    this.redraw();
  }

  async loadCharacters() {
    try {
      const res = await fetch('caracteres.json');
      if (!res.ok) throw new Error('Arquivo não encontrado');
      const data = await res.json();
      this.charData = data.caracteres;
    } catch (err) {
      console.warn('caracteres.json não carregado, usando fallback.');
      this.charData = [
        { ideograma: "一", pinyin: "yī", traducao: "um", dificuldade: "fácil", ordem_tracos: "1" },
        { ideograma: "人", pinyin: "rén", traducao: "pessoa", dificuldade: "fácil", ordem_tracos: "2" },
        { ideograma: "大", pinyin: "dà", traducao: "grande", dificuldade: "fácil", ordem_tracos: "3" },
        { ideograma: "口", pinyin: "kǒu", traducao: "boca", dificuldade: "fácil", ordem_tracos: "3" },
        { ideograma: "中", pinyin: "zhōng", traducao: "meio", dificuldade: "médio", ordem_tracos: "4" },
        { ideograma: "国", pinyin: "guó", traducao: "país", dificuldade: "médio", ordem_tracos: "8" }
      ];
    }
    // Inicializa a lista completa com o filtro "todas"
    this.applyFilter('todas');
  }

  // Aplica filtro de dificuldade e recarrega a lista de sugestões
  applyFilter(filter = 'todas') {
    if (!this.charData) return;
    this.allCharacters = filter === 'todas'
      ? [...this.charData]
      : this.charData.filter(c => c.dificuldade === filter);
    this.hideSuggestions();
    this.searchInput.value = '';
  }

  selectCharacter(ideograma) {
  const char = this.charData.find(c => c.ideograma === ideograma);
  if (!char) return;
  
  this.selectedChar = char;
  this.clearCanvas();
  
  document.getElementById('char-info').style.display = 'block';
  document.getElementById('char-pinyin').textContent = char.pinyin;
  document.getElementById('char-translation').textContent = char.traducao;
  document.getElementById('char-strokes').textContent = char.ordem_tracos;
  
  // Mostra informação adicional se for composto
  const charCount = char.ideograma.length;
  if (charCount > 1) {
    const infoDiv = document.createElement('small');
    infoDiv.className = 'text-info d-block mt-1';
    infoDiv.innerHTML = `📝 Palavra com ${charCount} caracteres`;
    const charInfo = document.getElementById('char-info');
    const oldInfo = charInfo.querySelector('.char-count-info');
    if (oldInfo) oldInfo.remove();
    infoDiv.className += ' char-count-info';
    charInfo.appendChild(infoDiv);
  }
  
  this.drawGuide();
}

  drawGuide() {
  if (!this.showGuide || !this.selectedChar) return;
  
  const w = this.canvas.width / 2;
  const h = this.canvas.height / 2;
  const size = Math.min(w, h);
  const x = size / 2;
  const y = size / 2;
  
  this.ctx.save();
  
  // Grade 4x4
  this.ctx.strokeStyle = '#e0e0e0';
  this.ctx.lineWidth = 0.5;
  const grid = 4;
  for (let i = 0; i <= grid; i++) {
    const pos = (size / grid) * i;
    this.ctx.beginPath(); 
    this.ctx.moveTo(0, pos); 
    this.ctx.lineTo(size, pos); 
    this.ctx.stroke();
    
    this.ctx.beginPath(); 
    this.ctx.moveTo(pos, 0); 
    this.ctx.lineTo(pos, size); 
    this.ctx.stroke();
  }
  
  // Tamanho adaptativo baseado no número de caracteres
  const charCount = this.selectedChar.ideograma.length;
  let fontSize;
  
  if (charCount === 1) {
    fontSize = size * 0.7;  // 70% para caractere único
  } else if (charCount === 2) {
    fontSize = size * 0.4;  // 40% para 2 caracteres
  } else if (charCount === 3) {
    fontSize = size * 0.28; // 28% para 3 caracteres
  } else {
    fontSize = size * 0.2;  // 20% para 4+ caracteres
  }
  
  this.ctx.fillStyle = 'rgba(200,200,200,0.35)';
  this.ctx.font = `${fontSize}px "KaiTi","楷体","STKaiti","SimSun",serif`;
  this.ctx.textAlign = 'center';
  this.ctx.textBaseline = 'middle';
  this.ctx.fillText(this.selectedChar.ideograma, x, y);
  
  this.ctx.restore();
}

  // ================== EVENTOS UNIFICADOS (POINTER) ==================
  setupPointerEvents() {
    this.canvas.onpointerdown = null;
    this.canvas.onpointermove = null;
    this.canvas.onpointerup   = null;
    this.canvas.onpointerleave= null;

    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.isDrawing = true;
      this.currentStroke = [];
      this.updateBrushSize(e);
      const pos = this.getCanvasPos(e);
      this.currentStroke.push(pos);
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, this.currentBrushSize/2, 0, Math.PI*2);
      this.ctx.fillStyle = '#000';
      this.ctx.fill();
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.updateBrushSize(e);
      const pos = this.getCanvasPos(e);
      this.currentStroke.push(pos);
      const prev = this.currentStroke[this.currentStroke.length-2] || pos;
      this.ctx.beginPath();
      this.ctx.moveTo(prev.x, prev.y);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = this.currentBrushSize;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.stroke();
    });

    const stop = () => {
      if (this.isDrawing) {
        this.strokes.push([...this.currentStroke]);
        this.currentStroke = [];
      }
      this.isDrawing = false;
    };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointerleave', stop);
  }

  updateBrushSize(e) {
    if (e.pointerType === 'pen') {
      const pressure = e.pressure || 0.1;
      this.currentBrushSize = Math.max(1, this.baseBrushSize * (0.5 + pressure * 1.5));
    } else {
      this.currentBrushSize = this.baseBrushSize;
    }
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = (this.canvas.width / 2) / rect.width;
    const scaleY = (this.canvas.height / 2) / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  // ================== BOTÕES ==================
  setupButtonEvents() {
    document.getElementById('clear-canvas-btn').onclick = () => this.clearCanvas();
    document.getElementById('check-calligraphy-btn').onclick = () => this.checkAccuracy();
    document.getElementById('toggle-guide-btn').onclick = () => this.toggleGuide();
    document.getElementById('undo-stroke-btn').onclick = () => this.undoLastStroke();

    document.getElementById('brush-size-sm').onclick = () => this.setBaseBrush(5);
    document.getElementById('brush-size-md').onclick = () => this.setBaseBrush(15);
    document.getElementById('brush-size-lg').onclick = () => this.setBaseBrush(30);

    // Filtro de dificuldade: recarrega a lista base e limpa busca
    document.getElementById('difficulty-filter').onchange = (e) => {
      this.applyFilter(e.target.value);
    };
  }

  setBaseBrush(size) {
    this.baseBrushSize = size;
    const ids = {5:'brush-size-sm', 15:'brush-size-md', 30:'brush-size-lg'};
    document.querySelectorAll('#calligraphy .btn-group .btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(ids[size]);
    if (activeBtn) activeBtn.classList.add('active');
  }

  clearCanvas() {
    this.strokes = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGuide();
    this.resetAccuracy();
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGuide();
    const allStrokes = [...this.strokes, this.currentStroke];
    allStrokes.forEach(stroke => {
      if (stroke.length < 2) return;
      this.ctx.beginPath();
      this.ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) this.ctx.lineTo(stroke[i].x, stroke[i].y);
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = this.baseBrushSize;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.stroke();
    });
  }

  undoLastStroke() {
    this.strokes.pop();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGuide();
    this.redraw();
  }

  toggleGuide() {
    this.showGuide = !this.showGuide;
    const btn = document.getElementById('toggle-guide-btn');
    btn.classList.toggle('active', this.showGuide);
    btn.innerHTML = this.showGuide ? '👁️' : '👁️‍🗨️';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGuide();
    this.redraw();
  }

  // ================== SISTEMA DE BUSCA INTELIGENTE ==================
  setupSearch() {
    this.searchInput.addEventListener('input', () => this.filterCharacters());
    this.searchInput.addEventListener('focus', () => {
      if (this.searchInput.value.trim()) this.filterCharacters();
    });
    // Fecha sugestões ao clicar fora
    document.addEventListener('click', (e) => {
      if (!this.searchInput.contains(e.target) && !this.suggestionsList.contains(e.target)) {
        this.hideSuggestions();
      }
    });
  }

  filterCharacters() {
  const query = this.searchInput.value.trim().toLowerCase();
  if (!query || this.allCharacters.length === 0) {
    this.hideSuggestions();
    return;
  }
  
  const filtered = this.allCharacters.filter(c => {
    return (
      c.ideograma.includes(query) ||
      c.pinyin.toLowerCase().includes(query) ||
      c.traducao.toLowerCase().includes(query)
    );
  });
  
  this.showSuggestions(filtered);
}

showSuggestions(chars) {
  if (chars.length === 0) {
    this.hideSuggestions();
    return;
  }
  
  this.suggestionsList.innerHTML = '';
  chars.forEach(c => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    
    // Badge para indicar palavras compostas
    const badge = c.ideograma.length > 1 
      ? '<span class="badge bg-info ms-2">palavra</span>' 
      : '';
    
    li.innerHTML = `
      <div>
        <strong style="font-size:1.2em;">${c.ideograma}</strong>
        ${badge}
        <br>
        <small>${c.pinyin} - ${c.traducao}</small>
      </div>
    `;
    
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      this.selectCharacter(c.ideograma);
      this.searchInput.value = '';
      this.hideSuggestions();
    });
    
    this.suggestionsList.appendChild(li);
  });
  this.suggestionsList.style.display = 'block';
}

  showSuggestions(chars) {
    if (chars.length === 0) {
      this.hideSuggestions();
      return;
    }
    this.suggestionsList.innerHTML = '';
    chars.forEach(c => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.innerHTML = `<strong>${c.ideograma}</strong> – ${c.pinyin} (${c.traducao})`;
      li.addEventListener('click', () => {
        this.selectCharacter(c.ideograma);
        this.searchInput.value = '';
        this.hideSuggestions();
      });
      this.suggestionsList.appendChild(li);
    });
    this.suggestionsList.style.display = 'block';
  }

  hideSuggestions() {
    this.suggestionsList.style.display = 'none';
  }

  // ================== VERIFICAÇÃO DE PRECISÃO (CORRIGIDA) ==================
  checkAccuracy() {
    if (!this.selectedChar) { alert('Selecione um caractere!'); return; }
    if (this.strokes.length === 0) { alert('Desenhe algo antes!'); return; }

    const accuracy = this.calculateJaccardAccuracy() * 2.35;
    this.displayAccuracy(accuracy);

     if (accuracy > 15) this.showCelebration(`Muito bom, continue treinando!`);
     else this.showCelebration(`Melhorar a precisão! Tente focar mais na forma do caractere.`);
    }

  calculateJaccardAccuracy() {
  const SIZE = 200;
  const idealCanvas = document.createElement('canvas');
  idealCanvas.width = SIZE;
  idealCanvas.height = SIZE;
  const iCtx = idealCanvas.getContext('2d');
  
  iCtx.fillStyle = '#FFFFFF';
  iCtx.fillRect(0, 0, SIZE, SIZE);
  iCtx.fillStyle = '#000000';
  
  // Tamanho adaptativo baseado no número de caracteres
  const charCount = this.selectedChar.ideograma.length;
  let fontSize;
  
  if (charCount === 1) {
    fontSize = SIZE * 0.55;
  } else if (charCount === 2) {
    fontSize = SIZE * 0.35;
  } else if (charCount === 3) {
    fontSize = SIZE * 0.25;
  } else {
    fontSize = SIZE * 0.18;
  }
  
  iCtx.font = `bold ${fontSize}px "KaiTi", "楷体", "STKaiti", "SimSun", "Microsoft YaHei", "Noto Sans SC", serif`;
  iCtx.textAlign = 'center';
  iCtx.textBaseline = 'middle';
  iCtx.fillText(this.selectedChar.ideograma, SIZE/2, SIZE/2);
  
  const idealData = iCtx.getImageData(0, 0, SIZE, SIZE).data;
  
  const userCanvas = document.createElement('canvas');
  userCanvas.width = SIZE;
  userCanvas.height = SIZE;
  const uCtx = userCanvas.getContext('2d');
  uCtx.fillStyle = '#FFFFFF';
  uCtx.fillRect(0, 0, SIZE, SIZE);
  uCtx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, SIZE, SIZE);
  const userData = uCtx.getImageData(0, 0, SIZE, SIZE).data;
  
  const margin = SIZE * 0.1;
  let intersection = 0, union = 0;
  for (let y = margin; y < SIZE - margin; y++) {
    for (let x = margin; x < SIZE - margin; x++) {
      const idx = (y * SIZE + x) * 4;
      const idealDark = idealData[idx] < 128;
      const userDark  = userData[idx] < 128;
      if (idealDark && userDark) { 
        intersection++; 
        union++; 
      } else if (idealDark || userDark) { 
        union++; 
      }
    }
  }
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

  displayAccuracy(pct) {
    const bar = document.getElementById('accuracy-bar');
    bar.style.width = pct + '%';
    bar.innerHTML = `<span class="fw-bold">${pct}%</span>`;
    bar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    if (pct > 80) bar.classList.add('bg-success');
    else if (pct > 50) bar.classList.add('bg-warning');
    else bar.classList.add('bg-danger');
  }

  resetAccuracy() {
    const bar = document.getElementById('accuracy-bar');
    bar.style.width = '0%';
    bar.innerHTML = '<span class="fw-bold">0%</span>';
    bar.className = 'progress-bar progress-bar-striped progress-bar-animated';
  }

  showCelebration(msg) {
    const old = document.querySelector('.celebration-overlay');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;';
    overlay.innerHTML = `<div style="background:#fff;border-radius:20px;padding:30px;text-align:center;max-width:90%;">
      <div style="font-size:50px;">🎨</div>
      <h4>${msg}</h4>
      <button class="btn btn-primary mt-2" onclick="this.closest('.celebration-overlay').remove()">Continuar</button>
    </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }
}

// Inicialização
let calligraphyInstance = null;
document.getElementById('calligraphy-tab').addEventListener('shown.bs.tab', () => {
  if (!calligraphyInstance) calligraphyInstance = new CalligraphyCanvas();
  else calligraphyInstance.resizeCanvas();
});