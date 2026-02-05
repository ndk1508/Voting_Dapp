App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  elections: {}, // Lưu trữ cuộc bầu cử
  userVotes: {}, // Lưu trữ: { "electionId": true/false }
  currentElectionId: null,
  candidateFieldCount: 0,
  currentFilter: 'all', // Bộ lọc hiện tại: 'all', 'active', 'ended'

  init: function() {
    console.log("1. Bắt đầu khởi tạo App...");
    
    // Tải danh sách cuộc bầu cử từ localStorage
    let savedElections = localStorage.getItem('voting_elections');
    if (savedElections) {
      App.elections = JSON.parse(savedElections);
    }
    
    // Tải danh sách vote của user từ localStorage
    let savedVotes = localStorage.getItem('voting_user_votes');
    if (savedVotes) {
      App.userVotes = JSON.parse(savedVotes);
    }
    
    // Khởi tạo form listeners
    App.initFormListeners();
    
    // Kiểm tra xem ví đã kết nối chưa
    let connectedAccount = sessionStorage.getItem('voting_account');
    if (connectedAccount) {
      App.account = connectedAccount;
      App.showLoginModal(false);
      App.displayAccount(connectedAccount);
      // Hiển thị danh sách cuộc bầu cử đã lưu
      setTimeout(() => App.displayElections(), 100);
      return App.initWeb3();
    } else {
      App.showLoginModal(true);
      // Hiển thị danh sách cuộc bầu cử cho người chưa đăng nhập
      setTimeout(() => App.displayElections(), 100);
    }
  },

  initFormListeners: function() {
    const createForm = document.getElementById('createElectionForm');
    if (createForm) {
      createForm.addEventListener('submit', App.handleCreateElection);
    }
  },

  showLoginModal: function(show) {
    const modal = document.getElementById('loginModal');
    const connectBtn = document.getElementById('connectBtn');
    
    if (!modal || !connectBtn) {
      console.error('Modal hoặc connectBtn không tìm thấy!');
      return;
    }
    
    if (show) {
      modal.style.display = 'flex';
      modal.style.visibility = 'visible';
      connectBtn.style.display = 'none';
    } else {
      modal.style.display = 'none';
      modal.style.visibility = 'hidden';
      connectBtn.style.display = 'inline-block';
    }
    
    console.log('Modal hiển thị:', show);
  },

  showCreateElectionModal: function() {
    const modal = document.getElementById('createElectionModal');
    if (modal) {
      modal.style.display = 'flex';
      // Khởi tạo 3 trường ứng cử viên mặc định
      App.candidateFieldCount = 0;
      document.getElementById('candidatesList').innerHTML = '';
      for (let i = 0; i < 3; i++) {
        App.addCandidateField();
      }
    }
  },

  closeCreateElectionModal: function() {
    const modal = document.getElementById('createElectionModal');
    if (modal) {
        modal.style.display = 'none';
      document.getElementById('createElectionForm').reset();
    }
  },

  addCandidateField: function() {
    const candidatesList = document.getElementById('candidatesList');
    const fieldId = 'candidate_' + App.candidateFieldCount;
    
    const field = document.createElement('div');
    field.className = 'input-group mb-2';
    field.id = fieldId;
    field.innerHTML = `
      <input type="text" class="form-control form-control-custom" placeholder="Tên ứng cử viên" required>
      <button class="btn btn-outline-danger" type="button" onclick="document.getElementById('${fieldId}').remove()">
        <i class="bi bi-trash"></i>
      </button>
    `;
    
    candidatesList.appendChild(field);
    App.candidateFieldCount++;
  },

  handleCreateElection: function(e) {
    e.preventDefault();
    
    const electionName = document.getElementById('electionName').value;
    const electionDescription = document.getElementById('electionDescription').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Lấy danh sách ứng cử viên
    const candidateInputs = document.querySelectorAll('#candidatesList input');
    const candidates = Array.from(candidateInputs).map((input, idx) => ({
      id: idx + 1,
      name: input.value.trim(),
      voteCount: 0
    })).filter(c => c.name !== '');

    // Validation
    if (!electionName.trim()) {
      alert('⚠️ Vui lòng nhập tên cuộc bầu cử!');
      return;
    }

    if (candidates.length < 2) {
      alert('⚠️ Phải có ít nhất 2 ứng cử viên!');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      alert('⚠️ Ngày kết thúc phải sau ngày bắt đầu!');
      return;
    }

    // 💾 Tạo ID cuộc bầu cử (dùng timestamp)
    const electionId = Date.now().toString();
    
    // 💾 Lưu cuộc bầu cử vào localStorage (SỬ DỤNG LOCAL STORAGE)
    const election = {
      id: electionId,
      name: electionName,
      description: electionDescription,
      candidates: candidates,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdBy: App.account,
      createdAt: new Date(),
      status: 'active'
    };
    
    App.elections[electionId] = election;
    localStorage.setItem('voting_elections', JSON.stringify(App.elections));
    
    alert(`✅ Tạo cuộc bầu cử "${electionName}" thành công!`);
    
    // Đóng modal và cập nhật giao diện
    App.closeCreateElectionModal();
    App.displayElections();
  },

  searchElections: function() {
    const searchInput = document.getElementById('searchElections');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    const electionsList = document.getElementById('electionsList');
    if (!electionsList) return;
    
    // Lấy danh sách đã lọc
    let filteredElections = App.getFilteredElections();
    
    // Tìm kiếm trong danh sách đã lọc
    if (searchTerm.trim() !== '') {
      filteredElections = filteredElections.filter(election => 
        election.name.toLowerCase().includes(searchTerm) || 
        election.description.toLowerCase().includes(searchTerm)
      );
    }
    
    App.renderElections(filteredElections);
  },

  renderElections: function(elections = null) {
    // Nếu không được truyền elections, lấy từ filter
    const electionsToRender = elections !== null ? elections : App.getFilteredElections();
    const electionsList = document.getElementById('electionsList');
    
    if (!electionsList) {
      console.error('electionsList div not found!');
      return;
    }
    
    if (electionsToRender.length === 0) {
      electionsList.innerHTML = '<p class="text-center text-muted">Chưa có cuộc bầu cử nào. <a href="#" onclick="App.showCreateElectionModal(); return false;">Tạo ngay</a></p>';
      return;
    }

    let html = '';
    electionsToRender.forEach(election => {
      const totalVotes = election.candidates.reduce((sum, c) => sum + c.voteCount, 0);
      const isActive = new Date() < new Date(election.endDate);
      
      html += `
        <div class="card card-custom mb-3 election-card">
          <div class="card-body">
            <div class="row">
              <div class="col-md-8">
                <h5 style="color: #667eea; margin-bottom: 10px;">
                  <i class="bi bi-check-square"></i> ${election.name}
                </h5>
                <p class="text-muted small mb-2">${election.description}</p>
                <p class="small mb-1"><strong>👥 Ứng cử viên:</strong> ${election.candidates.length}</p>
                <p class="small mb-1"><strong>📊 Tổng phiếu:</strong> ${totalVotes}</p>
                <p class="small mb-0"><strong>📅 Từ:</strong> ${new Date(election.startDate).toLocaleString('vi-VN')}</p>
                <p class="small"><strong>📅 Đến:</strong> ${new Date(election.endDate).toLocaleString('vi-VN')}</p>
              </div>
              <div class="col-md-4 text-end">
                <span class="badge ${isActive ? 'bg-success' : 'bg-danger'} mb-2 d-block">
                  ${isActive ? '🟢 Đang diễn ra' : '🔴 Đã kết thúc'}
                </span>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-primary-custom btn-custom flex-grow-1" onclick="App.viewElectionDetails('${election.id}')">
                    <i class="bi bi-eye"></i> Xem
                  </button>
                  <button class="btn btn-sm btn-info btn-custom" onclick="App.viewElectionResults('${election.id}')" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white;">
                    <i class="bi bi-bar-chart"></i> Kết Quả
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    electionsList.innerHTML = html;
  },

  displayElections: function() {
    console.log('displayElections called');
    console.log('App.elections:', App.elections);
    
    // Reset search input
    const searchInput = document.getElementById('searchElections');
    if (searchInput) searchInput.value = '';
    
    // Reset filter về 'all'
    App.currentFilter = 'all';
    App.updateFilterButtons();
    
    // Render all elections
    this.renderElections();
  },

  // ========== HÀM LỌC VÀ SẮP XẾP CUỘC BẦU CỬ ==========

  filterElectionsByStatus: function(status) {
    console.log('Lọc theo trạng thái:', status);
    App.currentFilter = status;
    App.updateFilterButtons();
    
    // Reset search khi lọc
    const searchInput = document.getElementById('searchElections');
    if (searchInput) searchInput.value = '';
    
    App.renderElections();
  },

  updateFilterButtons: function() {
    const filterAll = document.getElementById('filterAll');
    const filterActive = document.getElementById('filterActive');
    const filterEnded = document.getElementById('filterEnded');

    // Reset tất cả button
    [filterAll, filterActive, filterEnded].forEach(btn => {
      if (btn) btn.classList.remove('filter-btn-active');
    });

    // Active button theo filter hiện tại
    if (App.currentFilter === 'all' && filterAll) {
      filterAll.classList.add('filter-btn-active');
      filterAll.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      filterAll.style.color = 'white';
      filterAll.style.border = 'none';
    } else if (App.currentFilter === 'active' && filterActive) {
      filterActive.classList.add('filter-btn-active');
      filterActive.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
      filterActive.style.color = 'white';
      filterActive.style.border = 'none';
    } else if (App.currentFilter === 'ended' && filterEnded) {
      filterEnded.classList.add('filter-btn-active');
      filterEnded.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
      filterEnded.style.color = 'white';
      filterEnded.style.border = 'none';
    }
  },

  sortElections: function(elections) {
    const now = new Date();
    
    // Sắp xếp theo ưu tiên:
    // 1. Cuộc bầu cử đang diễn ra (sắp kết thúc trước)
    // 2. Cuộc bầu cử đã kết thúc (mới kết thúc trước)
    // 3. Cuộc bầu cử chưa bắt đầu
    
    return elections.sort((a, b) => {
      const aStart = new Date(a.startDate);
      const aEnd = new Date(a.endDate);
      const bStart = new Date(b.startDate);
      const bEnd = new Date(b.endDate);

      const aIsActive = now < aEnd && now >= aStart;
      const bIsActive = now < bEnd && now >= bStart;

      const aIsEnded = now >= aEnd;
      const bIsEnded = now >= bEnd;

      // Nếu cả hai đang diễn ra: sắp xếp theo ngày kết thúc (sắp kết thúc trước)
      if (aIsActive && bIsActive) {
        return aEnd - bEnd;
      }

      // Nếu chỉ a đang diễn ra: a trước
      if (aIsActive) return -1;
      if (bIsActive) return 1;

      // Nếu cả hai đã kết thúc: sắp xếp theo ngày kết thúc (mới kết thúc trước)
      if (aIsEnded && bIsEnded) {
        return bEnd - aEnd;
      }

      // Nếu chỉ a đã kết thúc: a trước
      if (aIsEnded) return -1;
      if (bIsEnded) return 1;

      // Cả hai chưa bắt đầu: sắp xếp theo ngày bắt đầu (sắp bắt đầu trước)
      return aStart - bStart;
    });
  },

  getFilteredElections: function() {
    let elections = Object.values(App.elections);
    const now = new Date();

    // Lọc theo trạng thái
    if (App.currentFilter === 'active') {
      elections = elections.filter(election => {
        const startDate = new Date(election.startDate);
        const endDate = new Date(election.endDate);
        return now >= startDate && now < endDate;
      });
    } else if (App.currentFilter === 'ended') {
      elections = elections.filter(election => {
        const endDate = new Date(election.endDate);
        return now >= endDate;
      });
    }

    // Sắp xếp danh sách
    return App.sortElections(elections);
  },

  viewElectionDetails: function(electionId) {
    console.log('viewElectionDetails called with ID:', electionId);
    const election = App.elections[electionId];
    if (!election) {
      console.error('Election not found for ID:', electionId);
      return;
    }
    
    App.currentElectionId = electionId;
    
    // Cập nhật title
    document.getElementById('electionDetailTitle').innerHTML = `
      <i class="bi bi-check-square"></i> ${election.name}
    `;

    // Cập nhật thông tin cuộc bầu cử
    const totalVotes = election.candidates.reduce((sum, c) => sum + c.voteCount, 0);
    const isActive = new Date() < new Date(election.endDate);
    
    document.getElementById('electionDetailInfo').innerHTML = `
      <p class="text-muted mb-2">${election.description}</p>
      <p class="small mb-2"><strong>📅 Từ:</strong> ${new Date(election.startDate).toLocaleString('vi-VN')}</p>
      <p class="small mb-2"><strong>📅 Đến:</strong> ${new Date(election.endDate).toLocaleString('vi-VN')}</p>
      <p class="small mb-0">
        <strong>Trạng thái:</strong> 
        <span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">
          ${isActive ? '🟢 Đang diễn ra' : '🔴 Đã kết thúc'}
        </span>
      </p>
    `;

    // Cập nhật danh sách ứng cử viên
    let candidatesHTML = `
<div style="
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  width: 100%;
">
`;

    const voteSelect = document.getElementById('voteSelect');
    voteSelect.innerHTML = '<option value="">-- Chọn ứng cử viên --</option>';
    
    election.candidates.forEach(candidate => {
      candidatesHTML += `
        <div style="padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; cursor: pointer; transition: all 0.3s;">
          <h6 style="color: #667eea; margin-bottom: 5px; font-weight: 600;">${candidate.name}</h6>
          <p style="margin-bottom: 0; font-size: 0.9rem;">
            <i class="bi bi-check-circle"></i> 
            <span class="badge badge-custom">${candidate.voteCount} phiếu</span>
          </p>
        </div>
      `;
      
      voteSelect.appendChild(new Option(candidate.name, candidate.id));
    });
    
    candidatesHTML += '</div>';
    document.getElementById('electionCandidatesList').innerHTML = candidatesHTML;

    // Kiểm tra xem có thể bỏ phiếu không - CHỈ DÙNG LOCAL DATA
    let canVote = true;
    let voteMessage = '';
    
    // Kiểm tra: cuộc bầu cử đã kết thúc chưa?
    if (!isActive) {
      canVote = false;
      voteMessage = '🔴 Cuộc bầu cử đã kết thúc, không thể bỏ phiếu!';
    }
    // Kiểm tra: user đã bỏ phiếu chưa?
    else if (App.userVotes[electionId]) {
      canVote = false;
      voteMessage = '✅ Bạn đã bỏ phiếu cho cuộc bầu cử này rồi!';
    }
    
    // Cập nhật trạng thái form bỏ phiếu
    const voteForm = document.getElementById('voteForm');
    const submitBtn = voteForm ? voteForm.querySelector('button[type="submit"]') : null;
    
    // Xóa message cũ nếu có
    const oldMessage = document.getElementById('voteMessage');
    if (oldMessage) oldMessage.remove();
    
    if (submitBtn) {
      if (canVote) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        voteForm.style.opacity = '1';
        voteForm.style.pointerEvents = 'auto';
      } else {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
        voteForm.style.opacity = '0.7';
        voteForm.style.pointerEvents = 'none';
        
        // Hiển thị thông báo
        if (voteMessage) {
          const messageDiv = document.createElement('div');
          messageDiv.id = 'voteMessage';
          messageDiv.style.cssText = 'padding: 10px; margin-bottom: 10px; border-radius: 8px; text-align: center; background: rgba(102, 126, 234, 0.1); color: #667eea; font-weight: 600;';
          messageDiv.innerHTML = voteMessage;
          
          voteForm.parentElement.insertBefore(messageDiv, voteForm);
        }
      }
    }

    // Mở modal
    const modal = document.getElementById('electionDetailModal');
    modal.style.display = 'flex ';
  },

  closeElectionDetailModal: function() {
    const modal = document.getElementById('electionDetailModal');
    if (modal) {
      modal.style.display = 'none';
      document.getElementById('voteForm').reset();
    }
  },

submitVote: async function () {
  const candidateId = document.getElementById('voteSelect').value;

  if (!candidateId) {
    alert('⚠️ Vui lòng chọn ứng cử viên!');
    return false;
  }

  if (!App.account) {
    alert('⚠️ Vui lòng kết nối ví Metamask!');
    return false;
  }

  try {
    const instance = await App.contracts.Election.deployed();

    const electionId = parseInt(App.currentElectionId);

    console.log('🚀 Gửi giao dịch vote...');

    // Gửi transaction
    const tx = await instance.vote(electionId, candidateId, {
      from: App.account,
      gas: 300000
    });

    // Nếu user cancel → sẽ nhảy thẳng xuống catch
    if (!tx || !tx.receipt) {
      throw new Error('Transaction không hợp lệ');
    }

    // Kiểm tra status blockchain
    if (!tx.receipt.status) {
      throw new Error('Transaction bị revert');
    }

    console.log('✅ TX confirmed:', tx.receipt.transactionHash);

    // ====== CHỈ update UI KHI ĐÃ CONFIRM ======

    const election = App.elections[App.currentElectionId];

    if (election) {
      const candidate = election.candidates.find(c => c.id == candidateId);

      if (candidate) {
        candidate.voteCount++;
        localStorage.setItem(
          'voting_elections',
          JSON.stringify(App.elections)
        );
      }
    }

    App.userVotes[App.currentElectionId] = true;

    localStorage.setItem(
      'voting_user_votes',
      JSON.stringify(App.userVotes)
    );

    alert('✅ Bỏ phiếu thành công trên Blockchain!');

    App.displayElections();
    App.closeElectionDetailModal();

    } catch (error) {
  
      console.error('❌ Vote error:', error);
  
      // User cancel MetaMask
    }
  },
  
    connectWallet: function() {
    if (!window.ethereum) {
      alert('❌ Metamask không được tìm thấy! Vui lòng cài đặt Metamask');
      return;
    }

    window.ethereum.request({ method: 'eth_requestAccounts' })
    .then(function(accounts) {
      if (accounts.length === 0) {
        alert('⚠️ Vui lòng chọn một tài khoản trong Metamask');
        return;
      }
      
      const account = accounts[0];
      App.account = account;
      
      sessionStorage.setItem('voting_account', account);
      
      console.log('✅ Kết nối Metamask thành công:', account);
      
      App.showLoginModal(false);
      App.displayAccount(account);
      
      // Theo dõi khi user thay đổi account trong Metamask
      if (window.ethereum.on) {
        window.ethereum.on('accountsChanged', function(accounts) {
          if (accounts.length > 0) {
            const newAccount = accounts[0];
            if (newAccount !== App.account) {
              console.log('🔄 Account thay đổi từ', App.account, 'sang', newAccount);
              App.account = newAccount;
              sessionStorage.setItem('voting_account', newAccount);
              App.displayAccount(newAccount);
              alert('⚠️ Tài khoản MetaMask đã thay đổi thành: ' + newAccount);
              App.displayElections();
            }
          } else {
            console.log('❌ Tất cả tài khoản đã bị ngắt kết nối');
            App.logout();
          }
        });
      }
      
      setTimeout(function() {
        App.initWeb3();
      }, 100);
    })
    .catch(function(error) {
      if (error.code === 4001) {
        console.log('❌ Người dùng từ chối kết nối Metamask');
      } else {
        console.error('❌ Lỗi kết nối Metamask:', error);
        alert('❌ Lỗi kết nối Metamask: ' + error.message);
      }
    });
  },

  switchWallet: function() {
    if (!window.ethereum) {
      alert('❌ MetaMask không được tìm thấy!');
      return;
    }
    
    if (confirm('Bạn muốn đăng xuất và kết nối ví khác?')) {
      App.logout();
      App.connectWallet();
    }
  },

  logout: function() {
    console.log('Logging out...');
    App.account = '0x0';
    App.userVotes = {}; // Reset user votes
    sessionStorage.removeItem('voting_account');
    localStorage.removeItem('voting_user_votes');
    
    const connectBtn = document.getElementById('connectBtn');
    const navAccount = document.getElementById('navAccount');
    
    if (connectBtn) connectBtn.style.display = 'inline-block';
    if (navAccount) navAccount.style.display = 'none';
    
    App.showLoginModal(true);
  },

  displayAccount: function(account) {
    const connectBtn = document.getElementById('connectBtn');
    const navAccount = document.getElementById('navAccount');
    const accountDisplay = document.getElementById('accountDisplay');
    const shortAddress = account.substring(0, 6) + '...' + account.substring(account.length - 4);
    
    if (accountDisplay) accountDisplay.textContent = shortAddress;
    if (navAccount) {
      navAccount.style.display = 'flex';
      navAccount.style.alignItems = 'center';
      navAccount.style.gap = '10px';
    }
    if (connectBtn) connectBtn.style.display = 'none';
  },

  initWeb3: function() {
    console.log("2. Khởi tạo Web3...");
    
    if (window.ethereum) {
      console.log("2a. Tìm thấy Metamask (window.ethereum)");
      App.web3Provider = window.ethereum;
      web3 = new Web3(window.ethereum);
    } else {
      console.log("2b. Không thấy Metamask, dùng Localhost 7545");
      App.web3Provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
      web3 = new Web3(App.web3Provider);
    }
    
    return App.initContract();
  },

  initContract: function() {
    console.log("3. Bắt đầu tải file Election.json...");
    $.getJSON("Election.json", function(election) {
      console.log("4. Đã tải xong Election.json");
      
      App.contracts.Election = TruffleContract(election);
      App.contracts.Election.setProvider(App.web3Provider);

      return App.render();
    }).fail(function() {
        console.error("❌ LỖI: Không tìm thấy file Election.json!");
        alert('❌ Lỗi: Không tìm thấy file Election.json!');
    });
  },

  render: function() {
    console.log("5. Bước render - hiển thị nội dung...");
    
    // Hiển thị danh sách cuộc bầu cử
    App.displayElections();
    $("#accountAddress").html(App.account);
    
    console.log("✅ Nội dung đã được hiển thị");
    
    // Tiếp tục init contract nếu cần
    console.log("6. Đang kết nối smart contract...");
    App.contracts.Election.deployed().then(function(instance) {
      console.log("✅ Đã kết nối được với Contract tại địa chỉ:", instance.address);
    }).catch(function(error) {
      console.log("⚠️ Không thể kết nối contract, nhưng ứng dụng vẫn hoạt động. Lỗi:", error.message);
      console.log("💡 Bạn vẫn có thể tạo cuộc bầu cử và sử dụng các tính năng cục bộ");
    });
  },

  // ========== HÀM XEM KỆT QUẢ BẦU CỬ ==========

  getElectionStatusText: function(statusCode) {
    const statusMap = {
      0: '🟡 Chưa bắt đầu',
      1: '🟢 Đang diễn ra',
      2: '🔴 Đã kết thúc'
    };
    return statusMap[statusCode] || 'Không xác định';
  },

  viewElectionResults: async function(electionId) {
    console.log('📊 Xem kết quả bầu cử ID:', electionId);
    const election = App.elections[electionId];
    
    if (!election) {
      alert('❌ Không tìm thấy cuộc bầu cử!');
      return;
    }

    try {
      // Cập nhật tiêu đề
      document.getElementById('resultsTitle').innerHTML = `
        <i class="bi bi-bar-chart"></i> Kết Quả: ${election.name}
      `;

      // Cập nhật thông tin cuộc bầu cử
      const isActive = new Date() < new Date(election.endDate);
      document.getElementById('resultsInfo').innerHTML = `
        <p class="text-muted mb-2">${election.description}</p>
        <p class="small mb-1"><strong>📅 Kết thúc:</strong> ${new Date(election.endDate).toLocaleString('vi-VN')}</p>
        <p class="small mb-0">
          <strong>Trạng thái:</strong>
          <span class="badge ${isActive ? 'bg-success' : 'bg-danger'}">
            ${isActive ? '🟢 Đang diễn ra' : '🔴 Đã kết thúc'}
          </span>
        </p>
      `;

      // Tính tổng phiếu từ local data
      const totalVotes = election.candidates.reduce((sum, c) => sum + c.voteCount, 0);

      // Tìm người chiến thắng
      let winner = null;
      let maxVotes = 0;
      let isTie = false;
      
      election.candidates.forEach(candidate => {
        if (candidate.voteCount > maxVotes) {
          maxVotes = candidate.voteCount;
          winner = candidate;
          isTie = false;
        } else if (candidate.voteCount === maxVotes && maxVotes > 0) {
          isTie = true;
        }
      });

      // Hiển thị thông tin chiến thắng/dẫn đầu
      let winnerHTML = '';
      if (isTie || maxVotes === 0) {
        winnerHTML = '<p class="alert alert-warning">⚠️ Chưa có người chiến thắng (hòa hoặc chưa có phiếu)</p>';
      } else {
        // Nếu cuộc bầu cử đang diễn ra = dẫn đầu, nếu đã kết thúc = chiến thắng
        const isLeading = isActive;
        const title = isLeading 
          ? '📈 <strong>Ứng viên đang dẫn đầu:</strong>' 
          : '🏆 <strong>Ứng viên chiến thắng:</strong>';
        const alertClass = isLeading ? 'alert-info' : 'alert-success';
        
        winnerHTML = `
          <div class="alert ${alertClass}">
            <h6>${title} ${winner.name}</h6>
            <p class="mb-0">${winner.voteCount} phiếu (${((winner.voteCount / totalVotes) * 100).toFixed(2)}%)</p>
          </div>
        `;
      }
      document.getElementById('winnerInfo').innerHTML = winnerHTML;

      // Hiển thị bảng kết quả chi tiết
      let resultsHTML = `
        <table class="table table-hover">
          <thead class="table-light">
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 35%;">Ứng Viên</th>
              <th style="width: 20%;" class="text-center">Phiếu Bầu</th>
              <th style="width: 40%;">Phần Trăm</th>
            </tr>
          </thead>
          <tbody>
      `;

      const sortedCandidates = [...election.candidates].sort((a, b) => b.voteCount - a.voteCount);
      
      sortedCandidates.forEach((candidate, index) => {
        const percentage = totalVotes === 0 ? 0 : ((candidate.voteCount / totalVotes) * 100).toFixed(2);
        const barWidth = totalVotes === 0 ? 0 : (candidate.voteCount / totalVotes) * 100;
        
        resultsHTML += `
          <tr>
            <td><strong>${index + 1}</strong></td>
            <td><strong>${candidate.name}</strong></td>
            <td class="text-center"><span class="badge bg-primary">${candidate.voteCount}</span></td>
            <td>
              <div class="progress" style="height: 25px;">
                <div class="progress-bar bg-gradient-primary" role="progressbar" 
                     style="width: ${barWidth}%; font-weight: bold; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;"
                     aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                  ${percentage}%
                </div>
              </div>
            </td>
          </tr>
        `;
      });

      resultsHTML += `
          </tbody>
        </table>
        <div class="alert alert-info mt-3">
          <strong>📊 Tổng phiếu bầu:</strong> ${totalVotes}
        </div>
      `;

      document.getElementById('resultsTable').innerHTML = resultsHTML;

      // Mở modal kết quả
      const modal = document.getElementById('electionResultsModal');
      if (modal) {
        modal.style.display = 'flex';
      }

    } catch (error) {
      console.error('❌ Lỗi khi xem kết quả:', error);
      alert('❌ Lỗi: ' + error.message);
    }
  },

  closeResultsModal: function() {
    const modal = document.getElementById('electionResultsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  },

  // Hàm lấy kết quả từ blockchain (nếu contract được deploy)
  getResultsFromBlockchain: async function(electionId) {
    try {
      const instance = await App.contracts.Election.deployed();
      const results = await instance.getElectionResults(electionId);
      
      console.log('📊 Kết quả từ blockchain:', results);
      
      return {
        electionId: results[0].toNumber(),
        name: results[1],
        totalVotes: results[2].toNumber(),
        status: results[3].toNumber(),
        winnerId: results[4].toNumber(),
        candidateIds: results[5].map(id => id.toNumber()),
        candidateNames: results[6],
        candidateVotes: results[7].map(v => v.toNumber()),
        candidatePercentages: results[8].map(p => p.toNumber())
      };
    } catch (error) {
      console.warn('⚠️ Không thể lấy dữ liệu từ blockchain:', error.message);
      return null;
    }
  },


};

$(function() {
  $(window).load(function() {
    App.init();
  });
});