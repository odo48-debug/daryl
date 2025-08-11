FROM python:3.11-slim

# Instala dependencias del sistema necesarias para Manim
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    ffmpeg \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-latex-extra \
    fonts-dejavu \
    git \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Instala Manim y librerías comunes
RUN pip install --no-cache-dir manim numpy matplotlib

# Define directorio de trabajo
WORKDIR /home/user

# Crea directorios útiles para scripts y salidas
RUN mkdir -p scripts output

# Crear un servidor HTTP simple para satisfacer el puerto 3000
RUN echo '#!/bin/bash\necho "Manim sandbox ready"\npython3 -m http.server 3000 &\nexec "$@"' > /start.sh
RUN chmod +x /start.sh

EXPOSE 3000

ENTRYPOINT ["/start.sh"]
CMD ["tail", "-f", "/dev/null"]