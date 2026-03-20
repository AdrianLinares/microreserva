#!/usr/bin/env node
import bcrypt from 'bcryptjs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function generateHash() {
  console.log('\n=== Generador de Hash de Contraseña ===\n');
  
  try {
    // 1) Pedimos password por terminal
    const password = await prompt('Ingrese la contraseña del administrador: ');
    
    // 2) Validamos longitud minima para evitar contraseñas debiles
    if (password.length < 8) {
      console.error('❌ Error: La contraseña debe tener al menos 8 caracteres.');
      rl.close();
      process.exit(1);
    }
    
    // 3) Confirmamos para reducir errores de tipeo
    const confirmPassword = await prompt('Confirme la contraseña: ');
    
    if (password !== confirmPassword) {
      console.error('❌ Error: Las contraseñas no coinciden.');
      rl.close();
      process.exit(1);
    }
    
    // 4) Generamos hash bcrypt (cost factor 12)
    console.log('\nGenerando hash con bcryptjs (cost factor: 12)...');
    const hash = await bcrypt.hash(password, 12);
    
    console.log('\n✅ Hash generado exitosamente:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(hash);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📋 Instrucciones:\n');
    console.log('1. Copia el hash anterior');
    console.log('2. En Netlify, ve a Site settings → Build & deploy → Environment');
    console.log('3. Añade una nueva variable de entorno:');
    console.log('   - Key: ADMIN_PASSWORD_HASH');
    console.log('   - Value: [pega el hash aquí]\n');
    console.log('4. También asegúrate de que ADMIN_USERNAME esté configurado\n');
    
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

generateHash();
