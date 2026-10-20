import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileImage, Printer } from 'lucide-react';
import { api } from '../api/client';
import PrivateImage from '../components/PrivateImage';
import { formatDateOfBirth } from '../utils/dates';
import { candidateName } from '../utils/candidates';
import CertificateCropControls from '../components/CertificateCropControls';
import logo from '../assets/logo.jpg';

export default function CandidateDetails({ printView = false }) {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState('');
  const [passportReady, setPassportReady] = useState(false);
  const [loadedCertificates, setLoadedCertificates] = useState({});
  const [crops, setCrops] = useState({
    certificate: { zoom: 1, horizontal: 50, vertical: 50, fitFull: false },
    certificate2: { zoom: 1, horizontal: 50, vertical: 50, fitFull: false },
  });
  useEffect(() => {
    if (!printView || !candidate) return;
    const previousTitle = document.title;
    document.title =
      [...candidateName(candidate)]
        .filter((character) => character.charCodeAt(0) >= 32)
        .join('')
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/[. ]+$/, '')
        .trim() || 'Student record';
    return () => {
      document.title = previousTitle;
    };
  }, [candidate, printView]);

  useEffect(() => {
    const controller = new AbortController();
    api(`/api/admin/candidates/${id}`, { signal: controller.signal })
      .then(setCandidate)
      .catch((error) => {
        if (error.name !== 'AbortError') setError(error.message);
      });
    return () => controller.abort();
  }, [id]);

  if (error)
    return (
      <div className="page-wrap empty-state" role="alert">
        <h1>Record unavailable</h1>
        <p>{error}</p>
        <Link className="secondary-button" to="/admin">
          Back to records
        </Link>
      </div>
    );
  if (!candidate)
    return (
      <div className="page-wrap empty-state" role="status">
        Loading candidate record…
      </div>
    );
  const name = candidateName(candidate);
  const kinds = candidate.has_second_certificate
    ? ['certificate', 'certificate2']
    : ['certificate'];
  const ready =
    passportReady && kinds.every((kind) => loadedCertificates[kind]);

  const certificate = (
    <section className={printView ? 'sheet-certificate' : 'certificate-card'}>
      <div className="certificate-heading">
        <FileImage size={19} />
        <h2>{kinds.length === 2 ? 'Certificates' : 'Certificate'}</h2>
      </div>
      {!printView && <p>{name}</p>}
      <div
        className={`certificates-grid ${kinds.length === 2 ? 'two-certificates' : ''}`}
      >
        {kinds.map((kind) => (
          <div className="certificate-item" key={kind}>
            {kinds.length === 2 && (
              <h3>
                {kind === 'certificate2' ? 'Certificate 2' : 'Certificate 1'}
              </h3>
            )}
            <div
              className={printView ? 'certificate-crop' : undefined}
              style={
                printView
                  ? {
                      '--certificate-zoom': crops[kind].zoom,
                      '--certificate-x': `${crops[kind].horizontal}%`,
                      '--certificate-y': `${crops[kind].vertical}%`,
                      '--certificate-fit': crops[kind].fitFull
                        ? 'contain'
                        : 'cover',
                    }
                  : undefined
              }
            >
              <PrivateImage
                candidateId={id}
                kind={kind}
                alt={`${kind === 'certificate2' ? 'Second certificate' : 'Certificate'} submitted by ${name}`}
                onReady={() =>
                  setLoadedCertificates((old) => ({ ...old, [kind]: true }))
                }
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className={`detail-page page-wrap ${printView ? 'print-view' : ''}`}>
      <Link
        to={printView ? `/admin/candidates/${id}` : '/admin'}
        className="back-link no-print"
      >
        <ArrowLeft size={16} />
        {printView ? 'Back to candidate' : 'Back to candidate records'}
      </Link>
      <div className="dashboard-heading no-print">
        <div>
          <span className="eyebrow">
            {printView ? 'PRINT PREVIEW' : 'CANDIDATE RECORD'}
          </span>
          <h1>{printView ? 'Ready for your records.' : name}</h1>
          <p>
            {printView
              ? 'Candidate information and certificate on one A4 page.'
              : 'Review personal information and supporting documents.'}
          </p>
        </div>
        {printView ? (
          <button
            className="primary-button"
            disabled={!ready}
            onClick={() => window.print()}
          >
            <Printer size={17} />
            {ready ? 'Print record' : 'Loading images…'}
          </button>
        ) : (
          <Link className="primary-button" to={`/admin/candidates/${id}/print`}>
            <Printer size={17} />
            Print record
          </Link>
        )}
      </div>
      {printView &&
        kinds.map((kind) => (
          <CertificateCropControls
            key={kind}
            kind={kind}
            value={crops[kind]}
            onChange={(value) => setCrops((old) => ({ ...old, [kind]: value }))}
          />
        ))}
      <article className="candidate-sheet">
        <div className="sheet-header">
          <img
            className="college-logo sheet-logo"
            src={logo}
            alt="Nsawkaw College of Education logo"
            width="64"
            height="64"
          />
          <div>
            <span className="eyebrow">Student Inventory</span>
            <h2>Student registration record</h2>
            {!printView && (
              <span className="sheet-reference no-print">
                {candidate.reference}
              </span>
            )}
          </div>
        </div>
        <div className="sheet-body">
          <div className="sheet-fields">
            <h3>Personal information</h3>
            <dl>
              <div className="sheet-full-name">
                <dt>Full name</dt>
                <dd>{name}</dd>
              </div>
              <div>
                <dt>Year of admission</dt>
                <dd>{candidate.admission_year}</dd>
              </div>
              <div>
                <dt>Mode of entry</dt>
                <dd>{candidate.mode_of_entry || 'Not recorded'}</dd>
              </div>
              <div>
                <dt>Current level</dt>
                <dd>
                  {candidate.current_level === 'Postgraduate'
                    ? candidate.current_level
                    : `Level ${candidate.current_level}`}
                </dd>
              </div>
              <div>
                <dt>Date of birth</dt>
                <dd>{formatDateOfBirth(candidate.date_of_birth)}</dd>
              </div>
              {!printView && (
                <div className="no-print">
                  <dt>Registration reference</dt>
                  <dd>{candidate.reference}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="passport-frame">
            <PrivateImage
              key={`passport-${id}`}
              candidateId={id}
              kind="passport"
              alt={`Passport photograph of ${name}`}
              onReady={() => setPassportReady(true)}
            />
            <span>Passport photograph</span>
          </div>
        </div>
        {printView && certificate}
        {!printView && (
          <div className="sheet-footer no-print">
            Registered on{' '}
            {new Date(
              candidate.created_at.replace(' ', 'T') + 'Z',
            ).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            <span>Private candidate record</span>
          </div>
        )}
      </article>
      {!printView && certificate}
    </div>
  );
}

