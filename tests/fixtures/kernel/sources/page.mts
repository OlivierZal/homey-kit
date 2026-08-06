const load = async (): Promise<unknown> => homeyApiGet(homey, '/thing')
const save = async (id: string): Promise<void> =>
  homeyApiPut(homey, `/thing/${id}`)
export { load, save }
