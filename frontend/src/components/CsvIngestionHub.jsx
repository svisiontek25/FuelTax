import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, AlertCircle, ArrowRight, ShieldCheck, Database, Layers, Save, Download } from 'lucide-react';

export default function CsvIngestionHub({ currentFleetId, quarter, onDataImported }) {
  const [importType, setImportType] = useState('mileage'); // 'mileage' or 'fuel'
  const [file, setFile] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [stagingResult, setStagingResult] = useState(null);
  const [error, setError] = useState(null);
  const [commitResult, setCommitResult] = useState(null);

  // Column Mappings
  const [mappings, setMappings] = useState({
    unit_number: 'Vehicle ID',
    jurisdiction: 'Jurisdiction',
    total_miles: 'Total Distance',
    taxable_miles: 'Taxable Distance',
    non_taxable_miles: 'Exempt Distance',
    trip_date: 'Date'
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    // Reset default mappings when type changes
    if (importType === 'mileage') {
      setMappings({
        unit_number: 'Vehicle ID',
        jurisdiction: 'Jurisdiction',
        total_miles: 'Total Distance',
        taxable_miles: 'Taxable Distance',
        non_taxable_miles: 'Exempt Distance',
        trip_date: 'Date'
      });
    } else {
      setMappings({
        unit_number: 'Unit Number',
        jurisdiction: 'State',
        gallons: 'Quantity',
        liters: '',
        transaction_date: 'Transaction Date',
        fuel_type: 'Product',
        tax_paid_at_pump: 'Tax Paid',
        vendor_name: 'Merchant Name',
        total_cost: 'Net Amount'
      });
    }
    setStagingResult(null);
    setCommitResult(null);
    setError(null);
  }, [importType]);

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleApplyTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl && tmpl.mappings) {
      setMappings(tmpl.mappings);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStagingResult(null);
      setCommitResult(null);
      setError(null);
    }
  };

  const handleStageCsv = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV or Excel file to upload.');
      return;
    }

    setLoading(true);
    setError(null);
    setStagingResult(null);
    setCommitResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fleet_id', currentFleetId || '');
    formData.append('quarter', quarter);
    formData.append('import_type', importType);
    formData.append('mappings_json', JSON.stringify(mappings));

    try {
      const res = await api.stageCsv(formData);
      setStagingResult(res);
    } catch (err) {
      setError(err.message || 'File staging failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommitBatch = async () => {
    if (!stagingResult || !stagingResult.batch_id) return;

    // Filter valid rows (exclude hard errors)
    const validRows = stagingResult.all_staged_rows.filter((r) => r.status !== 'HARD_ERROR');
    if (validRows.length === 0) {
      alert('Cannot commit batch: 0 valid rows found.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.commitCsv({
        batch_id: stagingResult.batch_id,
        fleet_id: currentFleetId,
        quarter,
        import_type: importType,
        valid_rows: validRows
      });
      setCommitResult(res);
      if (onDataImported) onDataImported();
    } catch (err) {
      alert(err.message || 'Commit failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
            CSV Data Ingestion & Audit Staging Pipeline
          </h2>
          <span className="badge badge-success">4-Year IFTA Audit Preserved</span>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Upload mileage logs and fuel receipts from Motive, Samsara, WEX, or custom spreadsheets with automated duplicate detection (SHA-256) and date boundary verification.
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div style={{
        display: 'flex',
        background: '#ffffff',
        padding: '6px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        width: 'fit-content',
        gap: '8px'
      }}>
        <button
          type="button"
          onClick={() => setImportType('mileage')}
          className={`btn ${importType === 'mileage' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Layers size={16} /> 1. Mileage Ingestion (Distance & Odometer)
        </button>
        <button
          type="button"
          onClick={() => setImportType('fuel')}
          className={`btn ${importType === 'fuel' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Database size={16} /> 2. Fuel Purchases Ingestion (Liters / Gallons)
        </button>
      </div>

      {/* Two Column Layout: Uploader & Column Mapper */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '24px'
      }}>
        {/* Left: File Upload & Template Picker */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Upload File (.csv, .xlsx, .xls)
            </h3>
            <a
              href={importType === 'mileage' ? '/sample_data/sample_mileage_ingestion_2026_Q1.csv' : '/sample_data/sample_fuel_purchases_2026_Q1.csv'}
              download={importType === 'mileage' ? 'sample_mileage_ingestion_2026_Q1.csv' : 'sample_fuel_purchases_2026_Q1.csv'}
              className="btn btn-secondary"
              style={{ fontSize: '11.5px', padding: '4px 10px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', borderColor: '#73A5CA', color: '#1B365D' }}
              title="Download verified sample CSV matching these column mapper fields"
            >
              <Download size={13} color="#60C1E5" /> Download Sample {importType === 'mileage' ? 'Mileage' : 'Fuel'} CSV
            </a>
          </div>

          <form onSubmit={handleStageCsv} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Template Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                Named Mapping Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleApplyTemplate(e.target.value)}
                className="form-input"
              >
                <option value="">Custom Mapping...</option>
                {templates
                  .filter((t) => t.import_type === importType)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.template_name}</option>
                  ))}
              </select>
            </div>

            {/* Drag & Drop File Zone */}
            <div style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '10px',
              padding: '30px 20px',
              textAlign: 'center',
              background: '#f8fafc',
              cursor: 'pointer'
            }}>
              <Upload size={32} color="#2563eb" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                {file ? file.name : 'Choose a file or drag & drop here'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Supported formats: CSV, XLSX, XLS (up to 50MB)
              </div>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                style={{ marginTop: '12px', fontSize: '12px' }}
              />
            </div>

            {error && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} shrink={0} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file}
              className="btn btn-primary"
              style={{ padding: '12px', fontSize: '14px' }}
            >
              {loading ? 'Processing & Validating Staging...' : 'Upload & Validate Staging Preview'}
            </button>
          </form>
        </div>

        {/* Right: Column Mapper */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
            Column Mapper (Headers in your File)
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
            Map your file's header column names to FuelTaxPulse system fields.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.keys(mappings).map((field) => (
              <div key={field} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                  {field.replace(/_/g, ' ')}:
                </span>
                <input
                  type="text"
                  value={mappings[field] || ''}
                  onChange={(e) => setMappings({ ...mappings, [field]: e.target.value })}
                  placeholder={`Header name in CSV`}
                  className="form-input"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Staging & Error Preview Table */}
      {stagingResult && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Staging Table & Compliance Pre-Check
                </h3>
                <span className="badge badge-info">{stagingResult.total_rows} Total Rows</span>
                {stagingResult.hard_error_count > 0 && (
                  <span className="badge badge-danger">{stagingResult.hard_error_count} Hard Errors</span>
                )}
                {stagingResult.warning_count > 0 && (
                  <span className="badge badge-warning">{stagingResult.warning_count} Warnings</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }} className="font-mono">
                SHA-256: {stagingResult.file_sha256}
              </div>
            </div>

            <button
              onClick={handleCommitBatch}
              disabled={loading || stagingResult.hard_error_count === stagingResult.total_rows}
              className="btn btn-primary"
            >
              <CheckCircle size={16} /> Commit Valid Rows to Active Fleet
            </button>
          </div>

          {commitResult && (
            <div style={{
              padding: '14px',
              borderRadius: '8px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle size={18} />
              <span>
                Successfully committed <strong>{commitResult.committed_count}</strong> records into active fleet!
                {commitResult.auto_created_units?.length > 0 && ` (Auto-created power units: ${commitResult.auto_created_units.join(', ')})`}
              </span>
            </div>
          )}

          {/* Staging Data Grid */}
          <div style={{ overflowX: 'auto', maxHeight: '450px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <tr>
                  <th style={{ padding: '8px 10px' }}>Row</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Unit #</th>
                  <th style={{ padding: '8px 10px' }}>Jurisdiction</th>
                  {importType === 'mileage' ? (
                    <>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Miles</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Taxable Miles</th>
                      <th style={{ padding: '8px 10px' }}>Date</th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Gallons</th>
                      <th style={{ padding: '8px 10px' }}>Product</th>
                      <th style={{ padding: '8px 10px' }}>Date</th>
                      <th style={{ padding: '8px 10px' }}>Tax-Paid</th>
                    </>
                  )}
                  <th style={{ padding: '8px 10px' }}>Validation Details</th>
                </tr>
              </thead>
              <tbody>
                {stagingResult.preview_rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>#{r.row_index}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.status === 'VALID' && (
                        <span className="badge badge-success">VALID</span>
                      )}
                      {r.status === 'WARNING' && (
                        <span className="badge badge-warning">WARN</span>
                      )}
                      {r.status === 'HARD_ERROR' && (
                        <span className="badge badge-danger">BLOCKING ERROR</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '700' }}>{r.unit_number}</td>
                    <td style={{ padding: '8px 10px', fontWeight: '700', color: '#2563eb' }}>{r.jurisdiction}</td>

                    {importType === 'mileage' ? (
                      <>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{r.total_miles}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{r.taxable_miles}</td>
                        <td style={{ padding: '8px 10px' }}>{r.trip_date || '—'}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }} className="tabular-nums">{r.gallons}</td>
                        <td style={{ padding: '8px 10px' }}>{r.fuel_type}</td>
                        <td style={{ padding: '8px 10px' }}>{r.transaction_date}</td>
                        <td style={{ padding: '8px 10px' }}>{r.tax_paid_at_pump ? 'Yes' : 'No'}</td>
                      </>
                    )}

                    <td style={{ padding: '8px 10px', fontSize: '11px' }}>
                      {r.errors?.map((err, errI) => (
                        <span key={errI} style={{ color: '#dc2626', display: 'block' }}>• {err}</span>
                      ))}
                      {r.warnings?.map((warn, warnI) => (
                        <span key={warnI} style={{ color: '#d97706', display: 'block' }}>• {warn}</span>
                      ))}
                      {!r.errors?.length && !r.warnings?.length && (
                        <span style={{ color: '#16a34a' }}>Ready to commit</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
