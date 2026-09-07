import { Asset } from 'expo-asset';
import { generateVisualEmbedding } from './visualEmbedding';

const PARITY_TEST_IMAGE = require('@/assets/ml/parity_test.png');

export async function runVisualParityTest() {
  console.log('');
  console.log('========================================');
  console.log('🔬 PC ↔ ANDROID VISUAL PARITY TEST');
  console.log('========================================');

  const asset = Asset.fromModule(PARITY_TEST_IMAGE);

  await asset.downloadAsync();

  const imageUri = asset.localUri ?? asset.uri;

  console.log('🖼️ Test image:', imageUri);

  const embedding = await generateVisualEmbedding(imageUri);

  const norm = Math.sqrt(
    embedding.reduce((sum, value) => sum + value * value, 0)
  );

  console.log('Dimension:', embedding.length);
  console.log('Norm:', norm);

  console.log('');
  console.log('First 20 values:');

  embedding.slice(0, 20).forEach((value, index) => {
    console.log(
      `${index.toString().padStart(2, '0')}: ${value.toFixed(12)}`
    );
  });

  console.log('');
  console.log('FULL_ANDROID_EMBEDDING=');
  console.log(JSON.stringify(embedding));

  return embedding;
}