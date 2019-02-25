import logger from '../logging';

const log = logger('S3Service');

export const uploadAttachment = (
  file: File,
  url: string,
  additionalFields: Array<{ name: string; value: string }>,
  progressCallback: (progress: number) => void,
): Promise<void> => {
  const form = new FormData();
  // NOTE: This order is important!
  additionalFields.forEach(field => {
    form.append(field.name, field.value);
  });
  form.append('Content-Type', file.type);
  form.append('file', file);

  const handleProgress = (e: ProgressEvent) => {
    // Convert bytes to integer percentage
    if (e.lengthComputable) {
      const percent = Math.floor((e.loaded / e.total) * 100);
      progressCallback(percent);
    }
  };

  log.info(`Uploading attachment of size ${file.size} to S3`);

  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.addEventListener('load', () => {
      if (req.status !== 200) {
        const error = `Upload to S3 failed with code ${req.status}`;
        log.info(error);
        reject(new Error(error));
      } else {
        resolve();
      }
    });
    req.addEventListener('abort', () => {
      const error = 'S3 upload was aborted';
      log.info(error);
      reject(new Error(error));
    });
    req.addEventListener('error', () => {
      const error = 'An error occurred uploading attachment to S3';
      log.error(error, {
        context: {
          requestStatus: req.statusText,
          attachmentType: file.type,
          attachmentSize: file.size,
          attachmentName: file.name,
        },
        logOptions: {
          logFirstOccurrence: true,
          frequency: 'every',
        },
      });
      reject(new Error(error));
    });

    if (progressCallback) {
      req.upload.addEventListener('progress', handleProgress);
    }

    req.open('POST', url, true);
    req.send(form);
  });
};
