import './DataTable.css';

export default function DataTable({ columns, data, emptyMessage = 'No records found.', keyField = 'id' }) {
  if (!data.length) {
    return (
      <div className="data-table-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={col.key === 'select' ? 'data-table__select' : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[keyField]}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  data-label={
                    typeof col.label === 'string' ? col.label : col.ariaLabel || col.key
                  }
                  className={col.key === 'select' ? 'data-table__select' : undefined}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
