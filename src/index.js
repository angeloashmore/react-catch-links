import React from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

const windowExists = typeof window !== 'undefined'

const checkSameOriginWithoutProtocol = (origin1, origin2) => {
  const protocolRegex = new RegExp(/(^\w+:|^)\/\//)
  const removeTrailingSlash = new RegExp(/\//g)

  return (
    origin1.replace(protocolRegex, ``).replace(removeTrailingSlash, ``) ===
    origin2.replace(protocolRegex, ``).replace(removeTrailingSlash, ``)
  )
}

const isExternalAnchor = (
  anchor,
  blacklist = [],
  whitelist = []
) => {
  // IE clears the host value if the anchor href changed after creation, e.g.
  // in React. Creating a new anchor element to ensure host value is present
  const a1 = document.createElement('a')
  a1.href = anchor.href

  // If the anchor host is in the blacklist, the anchor is always external.
  if (blacklist.includes(a1.hostname)) return true

  // If the anchor host is in the whitelist, the anchor is always internal.
  if (whitelist.includes(a1.hostname)) return false

  // If the anchor hostname is empty, the anchor is internal.
  if (!a1.hostname) return false

  // In IE, the default port is included in the anchor host but excluded from
  // the location host.  This affects the ability to directly compare
  // location host to anchor host.  For example: http://example.com would
  // have a location.host of 'example.com' and an anchor.host of
  // 'example.com:80' Creating anchor from the location.href to normalize the
  // host value.
  const a2 = document.createElement(`a`)
  a2.href = window.location.href

  if (a1.hostname !== a2.hostname) return true

  const anchoreUrl = new URL(a1.href)

  if (
    !checkSameOriginWithoutProtocol(window.location.origin, anchoreUrl.origin)
  )
    return true

  return false
}

const clickAnchor = anchor => {
  let event
  if (typeof MouseEvent === 'function') {
    event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    })
  } else {
    event = document.createEvent('MouseEvent')
    event.initMouseEvent(
      'click',
      true,
      true,
      window
    )
  }

  return anchor.dispatchEvent(event)
}

export class CatchLinks extends React.Component {
  static propTypes = {
    root: PropTypes.any,
    onClick: PropTypes.func.isRequired,
    blacklist: PropTypes.arrayOf(PropTypes.string),
    whitelist: PropTypes.arrayOf(PropTypes.string),
  }

  static defaultProps = {
    root: windowExists ? window : undefined,
    blacklist: [],
    whitelist: [],
  }

  constructor() {
    super()
    this.childRef = React.createRef()
  }

  componentDidMount() {
    const { root, onClick } = this.props
    if (!root || !onClick) return
    root.addEventListener('click', this.listener)
  }

  componentWillUnmount() {
    const { root } = this.props
    if (!root) return
    root.removeEventListener('click', this.listener)
  }

  listener = async event => {
    const { onClick, blacklist, whitelist } = this.props

    var anchor = null
    for (var n = event.target; n.parentNode; n = n.parentNode) {
      if (n.nodeName === `A`) {
        anchor = n
        break
      }
    }

    if (!anchor) return true

    const isExternal = isExternalAnchor(
      anchor,
      blacklist,
      whitelist
    )

    // Create clone of the anchor to allow clicking in onClick without
    // triggering the event listener.
    const clonedAnchor = document.createElement('a')
    clonedAnchor.href = anchor.href
    clonedAnchor.target = anchor.target
    clonedAnchor.style.display = 'none'
    document.body.appendChild(clonedAnchor)

    await Promise.resolve(
      onClick(event, {
        href: clonedAnchor.getAttribute('href'),
        continue: () => clickAnchor(clonedAnchor),
        clonedAnchor,
        isExternal,
        blacklist,
        whitelist,
      })
    )

    document.body.removeChild(clonedAnchor)
  }

  render() {
    return this.props.children
  }
}
