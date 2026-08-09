const load = async (): Promise<unknown> => homeyApiGet(homey, '/thing')
const save = async (id: string): Promise<void> =>
  homeyApiPut(homey, `/thing/${id}`)
export { load, save }
const remove = async (): Promise<void> => {
  await new Promise((resolve, reject) => {
    homey.api('DELETE', '/thing', reject, resolve)
  })
}
const rename = async (zone: { id: string }): Promise<void> =>
  homeyApiPut(homey, `/thing/${String({ id: zone.id }.id)}`)
export { remove, rename }
const tag = async (id: string): Promise<void> =>
  homeyApiPost(homey, `/thing/${id}/tag`, {})
export { tag }
const detail = async (id: string): Promise<unknown> =>
  homeyApiGet(homey, `/thing/${id}?full=1`)
const deepRename = async (zone: { id: { value: string } }): Promise<void> =>
  homeyApiPut(
    homey,
    `/thing/${String({ deep: { id: zone.id.value } }.deep.id)}`,
  )
export { deepRename, detail }
