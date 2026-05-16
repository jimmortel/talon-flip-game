import { Button, Frog, TextInput } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
import { createClient } from '@vercel/kv'

// Connexion isolée et propre à ta base de données Upstash
const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  title: 'TALON Flip - L'Œuf de la Fortune',
})

const TAXE_MAISON = 3.5 // Ta marge de rentabilité sur les gains (3.5%)
const SOLDE_INITIAL = 500 // Jetons gratuits offerts pour appâter le joueur

app.frame('/', async (c) => {
  const { buttonValue, inputText } = c
  const fid = c.frameData?.fid || 0 // Identifiant Farcaster unique de l'utilisateur
  
  const userKey = `player:${fid}:balance`
  const bankKey = `house:bank:wallet` // Clef pour suivre tes bénéfices cumulés

  // Récupération du solde du joueur
  let balance = await kv.get<number>(userKey)
  if (balance === null || balance === undefined) {
    balance = SOLDE_INITIAL
    await kv.set(userKey, balance)
  }

  let message = "Mise un montant en $TALON, choisis ton camp et tente de doubler ton capital !"
  let ecran = 'accueil' // accueil, gagne, perdu, erreur
  let mise = 0

  if (buttonValue === 'bouton_hatch' || buttonValue === 'bouton_crack') {
    const parsedBet = parseInt(inputText || '0', 10)
    
    if (isNaN(parsedBet) || parsedBet <= 0) {
      message = "❌ Tu dois entrer un montant valide supérieur à 0 !"
      ecran = 'erreur'
    } else if (parsedBet > balance) {
      message = `❌ Solde insuffisant ! Tu as actuellement ${balance} $TALON.`
      ecran = 'erreur'
    } else {
      mise = parsedBet
      const gagne = Math.random() < 0.5 // 50% de chance pur

      if (gagne) {
        // Logique de gain + prélèvement de ta taxe de 3.5%
        const gainBrut = mise
        const taxe = (gainBrut * TAXE_MAISON) / 100
        const gainNet = Math.floor(gainBrut - taxe)
        
        balance += gainNet
        ecran = 'gagne'
        message = `🎉 L'œuf a ÉCLOS ! Tu gagnes ${gainNet} $TALON (Taxe maison de ${TAXE_MAISON}% déduite).`
        
        // Ajout de la taxe dans ta caisse d'administration
        await kv.incrby(bankKey, Math.floor(taxe))
      } else {
        // Logique de perte : la mise va à 100% dans ta poche
        balance -= mise
        ecran = 'perdu'
        message = `💥 L'œuf s'est FÊLÉ... Tu perds ta mise de ${mise} $TALON.`
        
        // La banque récupère la mise perdue
        await kv.incrby(bankKey, mise)
      }
      
      // Sauvegarde du solde joueur mis à jour
      await kv.set(userKey, balance)
    }
  }

  // Design des visuels de l'œuf (Liens d'images fixes)
  let imageOeuf = 'https://i.imgur.com/8Yv9XbK.png' // L'œuf normal au centre
  if (ecran === 'gagne') imageOeuf = 'https://i.imgur.com/wM2Xg8e.png' // L'œuf qui éclot
  if (ecran === 'perdu') imageOeuf = 'https://i.imgur.com/XqK2XbK.png' // L'œuf brisé

  return c.res({
    image: (
      <div style={{
        backgroundColor: '#0d0e15',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        fontFamily: 'sans-serif',
      }}>
        {/* Header avec les jetons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '90%', position: 'absolute', top: '40px', fontSize: '24px' }}>
          <span style={{ color: '#b5b7da' }}>🎰 TALON FLIP</span>
          <span style={{ color: '#ffd700', fontWeight: 'bold' }}>💰 Solde: {balance} $TALON</span>
        </div>

        {/* Œuf Graphique */}
        <img src={imageOeuf} style={{ width: '240px', height: '240px', marginBottom: '30px', borderRadius: '20px' }} alt="Egg State" />

        {/* Message dynamique textuel */}
        <div style={{ 
          fontSize: '30px', 
          textAlign: 'center', 
          maxWidth: '85%', 
          fontWeight: '600',
          color: ecran === 'gagne' ? '#00ff87' : ecran === 'perdu' ? '#ff3366' : 'white'
        }}>
          {message}
        </div>
      </div>
    ),
    intents: [
      <TextInput placeholder="Mise (Ex: 50, 100, 500)..." />,
      <Button value="bouton_hatch">🥚 Parier Éclosion</Button>,
      <Button value="bouton_crack">⚡ Parier Fêlure</Button>
    ]
  })
})

// Si on visite la page sur un navigateur, on affiche la console de test Frog !
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  devtools(app, { serveStatic })
} else {
  devtools(app, { assetsPath: '/.frog' })
}

