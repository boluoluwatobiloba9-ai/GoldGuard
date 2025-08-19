;; GoldGuard Gold Token Contract
;; Clarity v2
;; Manages gold-backed token issuance, redemption, transfer, staking, and admin controls

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-BALANCE u101)
(define-constant ERR-INSUFFICIENT-STAKE u102)
(define-constant ERR-MAX-SUPPLY-REACHED u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INVALID-AMOUNT u106)
(define-constant ERR-ORACLE-VERIFICATION-FAILED u107)
(define-constant ERR-REDEMPTION-LOCKED u108)
(define-constant ERR-INVALID-RECIPIENT u109)

;; Token metadata
(define-constant TOKEN-NAME "GoldGuard Token")
(define-constant TOKEN-SYMBOL "GGT")
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-SUPPLY u1000000000000) ;; 1B tokens (1 token = 1 gram of gold, 6 decimals)
(define-constant MIN-REDEMPTION u1000000) ;; Minimum 1 gram for physical redemption
(define-constant REDEMPTION-LOCK-PERIOD u1440) ;; ~1 day in blocks (assuming 10-min blocks)

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var total-supply uint u0)
(define-data-var oracle principal tx-sender) ;; Oracle for gold deposit verification
(define-data-var redemption-enabled bool false)

;; Balances and stakes
(define-map balances principal uint)
(define-map staked-balances principal uint)
(define-map redemption-locks principal uint) ;; Tracks block height until redemption is allowed

;; Events for transparency
(define-data-var last-mint-event (tuple (recipient principal) (amount uint) (block-height uint)) {recipient: tx-sender, amount: u0, block-height: u0})
(define-data-var last-redemption-event (tuple (recipient principal) (amount uint) (block-height uint)) {recipient: tx-sender, amount: u0, block-height: u0})

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: is-oracle
(define-private (is-oracle)
  (is-eq tx-sender (var-get oracle))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: check redemption lock
(define-private (check-redemption-lock (account principal))
  (let ((lock-height (default-to u0 (map-get? redemption-locks account))))
    (asserts! (>= block-height lock-height) (err ERR-REDEMPTION-LOCKED))
    true
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Set oracle address
(define-public (set-oracle (new-oracle principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-oracle 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set oracle new-oracle)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Enable/disable redemption
(define-public (set-redemption-enabled (enabled bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set redemption-enabled enabled)
    (ok enabled)
  )
)

;; Mint tokens with oracle verification
(define-public (mint (recipient principal) (amount uint) (oracle-verified bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-oracle) (err ERR-ORACLE-VERIFICATION-FAILED))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((new-supply (+ (var-get total-supply) amount)))
      (asserts! (<= new-supply MAX-SUPPLY) (err ERR-MAX-SUPPLY-REACHED))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (var-set total-supply new-supply)
      (var-set last-mint-event {recipient: recipient, amount: amount, block-height: block-height})
      (ok true)
    )
  )
)

;; Redeem tokens for physical gold
(define-public (redeem (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (var-get redemption-enabled) (err ERR-REDEMPTION-LOCKED))
    (asserts! (>= amount MIN-REDEMPTION) (err ERR-INVALID-AMOUNT))
    (check-redemption-lock tx-sender)
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (map-set redemption-locks tx-sender (+ block-height REDEMPTION-LOCK-PERIOD))
      (var-set total-supply (- (var-get total-supply) amount))
      (var-set last-redemption-event {recipient: tx-sender, amount: amount, block-height: block-height})
      (ok true)
    )
  )
)

;; Transfer tokens
(define-public (transfer (recipient principal) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((sender-balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= sender-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- sender-balance amount))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (ok true)
    )
  )
)

;; Stake tokens for governance
(define-public (stake (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (map-set staked-balances tx-sender (+ amount (default-to u0 (map-get? staked-balances tx-sender))))
      (ok true)
    )
  )
)

;; Unstake tokens
(define-public (unstake (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((stake-balance (default-to u0 (map-get? staked-balances tx-sender))))
      (asserts! (>= stake-balance amount) (err ERR-INSUFFICIENT-STAKE))
      (map-set staked-balances tx-sender (- stake-balance amount))
      (map-set balances tx-sender (+ amount (default-to u0 (map-get? balances tx-sender))))
      (ok true)
    )
  )
)

;; Read-only: get balance
(define-read-only (get-balance (account principal))
  (ok (default-to u0 (map-get? balances account)))
)

;; Read-only: get staked balance
(define-read-only (get-staked (account principal))
  (ok (default-to u0 (map-get? staked-balances account)))
)

;; Read-only: get total supply
(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: get oracle
(define-read-only (get-oracle)
  (ok (var-get oracle))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: check redemption status
(define-read-only (is-redemption-enabled)
  (ok (var-get redemption-enabled))
)

;; Read-only: get last mint event
(define-read-only (get-last-mint-event)
  (ok (var-get last-mint-event))
)

;; Read-only: get last redemption event
(define-read-only (get-last-redemption-event)
  (ok (var-get last-redemption-event))
)

;; Read-only: get redemption lock for account
(define-read-only (get-redemption-lock (account principal))
  (ok (default-to u0 (map-get? redemption-locks account)))
)