export const INIT_CLIENT_EVENTS = {

  CLIENT_INIT_STARTED: 'CLIENT_INIT_STARTED',

  // the client manager is loading the release / version list from a remote repo 
  RESOLVE_RELEASE_STARTED: 'RESOLVE_RELEASE_STARTED',
  RESOLVE_RELEASE_FINISHED: 'RESOLVE_RELEASE_FINISHED',

  // the download of client binaries started
  DOWNLOAD_STARTED: 'DOWNLOAD_STARTED',
  DOWNLOAD_PROGRESS: 'DOWNLOAD_PROGRESS',
  DOWNLOAD_FINISHED: 'DOWNLOAD_FINISHED',

  // 
  VERIFICATION_ERROR: 'VERIFICATION_ERROR',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  PACKAGE_WRITTEN: 'PACKAGE_WRITTEN',
  BINARY_EXTRACTION_STARTED: 'BINARY_EXTRACTION_STARTED',
  BINARY_EXTRACTION_FINISHED: 'BINARY_EXTRACTION_FINISHED',

  // the extraction of all package contents started
  PACKAGE_EXTRACTION_STARTED: 'PACKAGE_EXTRACTION_STARTED',
  PACKAGE_EXTRACTION_PROGRESS: 'PACKAGE_EXTRACTION_PROGRESS',
  PACKAGE_EXTRACTION_FINISHED: 'PACKAGE_EXTRACTION_FINISHED',

  RESOLVE_DEPENDENCIES_STARTED: 'RESOLVE_DEPENDENCIES_STARTED',
  RESOLVE_DEPENDENCIES_FINISHED: 'RESOLVE_DEPENDENCIES_FINISHED',

  DOCKERFILE_FOUND: 'DOCKERFILE_FOUND',

  CREATE_DOCKER_IMAGE_FROM_FILE_STARTED: 'CREATE_DOCKER_IMAGE_FROM_FILE_STARTED',
  CREATE_DOCKER_IMAGE_FROM_FILE_FINISHED: 'CREATE_DOCKER_IMAGE_FROM_FILE_FINISHED',

  FIND_EXISTING_DOCKER_CONTAINER_STARTED: 'FIND_EXISTING_DOCKER_CONTAINER_STARTED',
  FIND_EXISTING_DOCKER_CONTAINER_FINISHED: 'FIND_EXISTING_DOCKER_CONTAINER_FINISHED',

  CREATE_DOCKER_CONTAINER_STARTED: 'CREATE_DOCKER_CONTAINER_STARTED',
  CREATE_DOCKER_CONTAINER_FINISHED: 'CREATE_DOCKER_CONTAINER_FINISHED',

  DOCKER_CLIENT_READY: 'DOCKER_CLIENT_READY',

  // raw docker events during setup of images & containers
  DOCKER_EVENT: 'DOCKER_EVENT',

}