/** Read every page, including when the server caps responses below our requested page size. */
export async function readAllPages(fetchPage, maximum = 100000) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await fetchPage(offset, offset + 499);
    if (error) throw new Error(error.message || 'Data could not be loaded');
    if (!Array.isArray(data)) throw new Error('Invalid data response');
    if (!data.length) return rows;
    rows.push(...data);
    if (rows.length > maximum) throw new Error('Too many records to load safely. Contact support before continuing.');
    offset += data.length;
  }
}
