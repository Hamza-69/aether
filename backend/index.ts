import app from './app'
import { AI_IDE_PORT } from './config'

app.listen(AI_IDE_PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${AI_IDE_PORT}`)
})
