import { Button, Frog, TextInput } from 'frog'
import { devtools } from 'frog/dev'
import { handle } from 'frog/next'
import { createClient } from '@vercel/kv'

// Connexion Upstash
const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  title: 'TALON Flip - L\'Œuf de la Fortune',
})

const TAXE_MAISON = 3.5 
const SOLDE_INITIAL = 500 

app.frame('/', async (c) => {
  const { buttonValue, inputText } = c
  const fid = c.frameData?.fid || 0 

  const userKey = `player:${fid}:balance`
  const bankKey = `house:bank:wallet`

  let balance = await kv.get<number>(userKey)
  if (balance === null || balance === undefined) {
    balance = SOLDE_INITIAL
    await kv.set(userKey, balance)
  }

  let message = "Mise un montant en $TALON, choisis ton camp et tente de doubler ton capital !"
  let ecran = 'accueil'
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
      const gagne = Math.random() < 0.5

      if (gagne) {
        const gainBrut = mise
        const taxe = (gainBrut * TAXE_MAISON) / 100
        const gainNet = Math.floor(gainBrut - taxe)

        balance += gainNet
        ecran = 'gagne'
        message = `🐣 L'œuf a ÉCLOS ! Tu gagnes ${gainNet} $TALON (Taxe maison de ${TAXE_MAISON}% déduite).`
        await kv.incrby(bankKey, Math.floor(taxe))
      } else {
        balance -= mise
        ecran = 'perdu'
        message = `🔥 L'œuf s'est FÊLÉ... Tu perds ta mise de ${mise} $TALON.`
        await kv.incrby(bankKey, mise)
      }
      await kv.set(userKey, balance)
    }
  }

  let imageOeuf = 'https://i.imgur.com/8YV9XbK.png'
  if (ecran === 'gagne') imageOeuf = 'https://i.imgur.com/vM2Kg8e.png'
  if (ecran === 'perdu') imageOeuf = 'https://i.imgur.com/XqK2XbE.png'

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
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '90%', position: 'absolute', top: '40px', fontSize: '24px' }}>
          <span style={{ color: '#b5b7da' }}>🥚 TALON FLIP</span>
          <span style={{ color: '#ffd700', fontWeight: 'bold' }}>💰 Solde: {balance} $TALON</span>
        </div>
        <img src={imageOeuf} style={{ width: '240px', height: '240px', marginBottom: '30px', borderRadius: '20px' }} alt="Egg State" />
        <div style={{
          fontSize: '30px',
          textAlign: 'center',
          maxWidth: '85%',
          fontWeight: '600',
          color: ecran === 'gagne' ? '#00FF87' : ecran === 'perdu' ? '#FF3366' : 'white'
        }}>
          {message}
        </div>
      </div>
    ),
    intents: [
      <TextInput placeholder="Mise (Ex: 50, 100, 500)..." />,
      <Button value="bouton_hatch">🥚 Parier Éclosion</Button>,
      <Button value="bouton_crack">⚡ Parier Félure</Button>,
    ]
  })
})

devtools(app, { assetsPath: '/.frog' })

export const GET = handle(app)
export const POST = handle(app)
