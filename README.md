# Hemo Eficiência Tracker - MVP

Este é um MVP (Produto Mínimo Viável) de um PWA (Progressive Web App) para tracking de tempos de procedimento na Hemodinâmica. Ele foi construído com HTML, Tailwind CSS e JavaScript puro.

## Funcionalidades

- **Leitor de Código de Barras:** Utiliza a câmera do dispositivo para ler o código de barras da pulseira do paciente.
- **Cronômetro:** Permite iniciar, pausar e resetar um cronômetro para medir o tempo do procedimento.
- **Registro de Saída:** Captura a sala, o leito de destino e o tempo final do procedimento.
- **PWA Instalável:** Pode ser adicionado à tela inicial de dispositivos móveis para uma experiência de aplicativo nativo.

## Pré-requisitos

- [Node.js](https://nodejs.org/) (que inclui o npm)
- [Visual Studio Code](https://code.visualstudio.com/)
- Extensão "Live Server" para o VS Code

## Configuração do Ambiente de Desenvolvimento

1.  **Clone o Repositório:**
    Se você subir este projeto para o GitHub, clone seu repositório. Caso contrário, apenas crie a pasta `HemoTracker` e os arquivos conforme descrito.

2.  **Crie os Ícones:**
    Dentro da pasta do projeto, crie uma subpasta chamada `icons`. Crie duas imagens quadradas e salve-as como `icon-192x192.png` e `icon-512x512.png`.

3.  **Instale as Dependências:**
    Abra um terminal dentro da pasta do projeto e instale o Tailwind CSS:
    ```bash
    npm install -D tailwindcss
    npx tailwindcss init
    ```
    Isso irá instalar o Tailwind e criar o arquivo `tailwind.config.js`. Substitua o conteúdo do `tailwind.config.js` gerado pelo que foi fornecido neste projeto.

## Rodando o Projeto Localmente

1.  **Compile o CSS com Tailwind:**
    No terminal, execute o seguinte comando. Ele irá "observar" seu arquivo `input.css` e gerar o `output.css` automaticamente sempre que você fizer uma alteração.
    ```bash
    npx tailwindcss -i ./input.css -o ./output.css --watch
    ```
    **Importante:** Deixe este terminal rodando enquanto você desenvolve.

2.  **Inicie o Servidor Local:**
    Abra um novo terminal ou use a interface do VS Code. Clique com o botão direito no arquivo `index.html` e selecione **"Open with Live Server"**.
    Seu aplicativo será aberto no navegador em um endereço como `http://127.0.0.1:5500`.

## Implantação na Vercel

1.  **Crie um Repositório no GitHub:**
    - Crie uma conta no [GitHub](https://github.com/).
    - Crie um novo repositório e envie todos os arquivos do seu projeto para ele.

2.  **Conecte à Vercel:**
    - Crie uma conta gratuita na [Vercel](https://vercel.com/) e conecte-a à sua conta do GitHub.
    - No dashboard da Vercel, clique em "Add New..." -> "Project".
    - Selecione o repositório do seu projeto no GitHub e clique em "Import".

3.  **Configure e Implante:**
    - A Vercel deve detectar automaticamente que é um projeto estático.
    - Na seção "Build and Output Settings", clique em "Override" ao lado de "Build Command".
    - No campo do "Build Command", cole o seguinte comando:
      ```bash
      npm install tailwindcss && npx tailwindcss -i ./input.css -o ./output.css
      ```
    - Clique em **"Deploy"**.

A Vercel irá instalar o Tailwind, compilar seu CSS e implantar seu site. Em menos de um minuto, você terá um link HTTPS público para seu aplicativo, pronto para ser compartilhado e instalado em qualquer celular.