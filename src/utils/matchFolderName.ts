export default function matchFolderName(models: string[], name: string): string {
  let returnMatch = 'other'
  for (const model of models) {
    if (name.substring(0, model.length) === model) {
      returnMatch = model
      break
    }
  }

  return returnMatch
}
