export interface DinoGenerationResult {
  name: string;
  habitat: string;
  diet: string;
  type: "Speedy" | "Tank" | "Balanced" | "Agile";
  description: string;
  stats: {
    speed: number;
    health: number;
    jump: number;
  };
  imagePrompt: string;
}

export interface BackendPayload {
  details: DinoGenerationResult;
  rawImageUrl: string;
}

export async function generateDinoPayload(habitat: string, diet: string, preferences: string): Promise<BackendPayload> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ habitat, diet, preferences })
  });

  if (!response.ok) {
    throw new Error(`Failed to generate Dino on backend: ${response.statusText}`);
  }

  return await response.json();
}

export async function compressImage(base64: string, maxWidth = 512, maxHeight = 512, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 240 && g > 240 && b > 240) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      resolve(canvas.toDataURL('image/png', quality));
    };
    img.onerror = (err) => reject(err);
  });
}
