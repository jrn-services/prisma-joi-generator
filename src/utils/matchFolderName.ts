export default function matchFolderName(models: string[], name: string): string {

  let returnMatch = '/Other/'
  for (const model of models) {
    if (name.substring(0, model.length) === model) {
      returnMatch = `/${model}/`
    }
  }

  return returnMatch
}
