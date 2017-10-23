// @flow

import logger from 'logging';

const log = logger('S3Service');

export const uploadAttachment = (
  file: File,
  url: string,
  additionalFields: Array<{name: string, value: string}>,
  progressCallback: (progress: number) => void,
): Promise<*> => {
  const form = new FormData();
  additionalFields.forEach(field => {
    form.append(field.name, field.value);
  });
  form.append('file', file);

  const handleProgress = (e: ProgressEvent) => {
    // Convert bytes to integer percentage
    if (e.lengthComputable) {
      const percent = Math.floor(e.loaded / e.total * 100);
      progressCallback(percent);
    }
  };

  log.info(`Uploading attachment of size ${file.size} to S3`);

  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.addEventListener('load', () => {
      if (req.status !== 200) {
        log.info(`Upload to S3 failed with code ${req.status}`);
        reject();
      } else {
        resolve();
      }
    });
    req.addEventListener('abort', () => {
      log.info('S3 attachment upload aborted');
      reject();
    });
    req.addEventListener('error', () => {
      log.error(`An error occurred uploading an attachment to S3`, {
        data: {
          requestStatus: req.statusText,
          attachmentType: file.type,
          attachmentSize: file.size,
          attachmentName: file.name,
        },
      });
      reject();
    });

    if (progressCallback) {
      req.upload.addEventListener('progress', handleProgress);
    }

    req.open('POST', url, true);
    req.send(form);
  });
};
