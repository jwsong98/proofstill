def proofstill_cli(project):
    installed = project / 'node_modules/@digitalpresso/proofstill/bin/proofstill.mjs'
    return installed if installed.is_file() else project / '.proofstill-runtime/bin/proofstill.mjs'
