import readline from 'readline'

// WARNING. the spinners (ora) that are used in printEventsToCLI
// mess with stdin and out  which is why we have to wait
// before we can init readline

export const ask = (question: string) : Promise<string> => {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    rl.question(question, function(answer) {
      rl.close()
      resolve(answer)
    });
  })
}