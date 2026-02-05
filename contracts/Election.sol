// contracts/Election.sol
pragma solidity ^0.8.0;

contract Election {
    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }
    
    struct ElectionStruct {
        uint id;
        string name;
        string description;
        uint startDate;
        uint endDate;
        address creator;
        uint candidatesCount;
        bool active;
    }
    
    mapping(uint => ElectionStruct) public elections;
    mapping(uint => mapping(uint => Candidate)) public candidates; // electionId => candidateId => Candidate
    mapping(uint => mapping(address => bool)) public voters; // electionId => voterAddress => hasVoted
    
    uint public electionsCount;
    
    event ElectionCreated (
        uint indexed _electionId,
        string _name,
        address _creator
    );
    
    event CandidateAdded (
        uint indexed _electionId,
        uint indexed _candidateId,
        string _name
    );
    
    event VotedEvent (
        uint indexed _electionId,
        uint indexed _candidateId,
        address _voter
    );

    
    
    function createElection(string memory _name, string memory _description, uint _startDate, uint _endDate) public {
        require(bytes(_name).length > 0, "Ten cuoc bau cu khong duoc trong");
        require(_endDate > _startDate, "Ngay ket thuc phai sau ngay bat dau");
        
        electionsCount++;
        uint electionId = electionsCount;
        
        elections[electionId] = ElectionStruct(
            electionId,
            _name,
            _description,
            _startDate,
            _endDate,
            msg.sender,
            0,
            true
        );
        
        emit ElectionCreated(electionId, _name, msg.sender);
    }
    
    function addCandidateToElection(uint _electionId, string memory _name) public {
        require(elections[_electionId].id != 0, "Cuoc bau cu khong ton tai");
        require(elections[_electionId].creator == msg.sender, "Chi nguoi tao moi co the them ung cu vien");
        require(bytes(_name).length > 0, "Ten ung cu vien khong duoc trong");
        
        elections[_electionId].candidatesCount++;
        uint candidateId = elections[_electionId].candidatesCount;
        
        candidates[_electionId][candidateId] = Candidate(candidateId, _name, 0);
        
        emit CandidateAdded(_electionId, candidateId, _name);
    }
    
    function vote(uint _electionId, uint _candidateId) public {
        require(electionsCount > 0, "Chua co cuoc bau cu nao");
        require(elections[_electionId].id != 0, "Cuoc bau cu khong ton tai");
        
        require(elections[_electionId].active, "Cuoc bau cu khong con hoat dong");
        require(!voters[_electionId][msg.sender], "Ban da bo phieu cho cuoc bau cu nay roi");
        require(_candidateId > 0 && _candidateId <= elections[_electionId].candidatesCount, "Ung cu vien khong ton tai");
        require(block.timestamp >= elections[_electionId].startDate, "Cuoc bau cu chua bat dau");
        require(block.timestamp <= elections[_electionId].endDate, "Cuoc bau cu da ket thuc");
        
        voters[_electionId][msg.sender] = true;
        candidates[_electionId][_candidateId].voteCount++;
        
        emit VotedEvent(_electionId, _candidateId, msg.sender);
    }
    
    function getCandidate(uint _electionId, uint _candidateId) public view returns (uint, string memory, uint) {
        Candidate memory candidate = candidates[_electionId][_candidateId];
        return (candidate.id, candidate.name, candidate.voteCount);
    }
    
    function getElection(uint _electionId) public view returns (uint, string memory, string memory, uint, uint, address, uint, bool) {
        ElectionStruct memory election = elections[_electionId];
        return (election.id, election.name, election.description, election.startDate, election.endDate, election.creator, election.candidatesCount, election.active);
    }
    
    function hasVoted(uint _electionId, address _voter) public view returns (bool) {
        return voters[_electionId][_voter];
    }
    
    function isElectionActive(uint _electionId) public view returns (bool) {
        if (elections[_electionId].id == 0) return false;
        return block.timestamp >= elections[_electionId].startDate && block.timestamp <= elections[_electionId].endDate;
    }
    
    // ========== HÀM LẤY KẾT QUẢ BẦU CỬ ==========
    
    /**
     * Lấy tổng số phiếu bầu của một cuộc bầu cử
     */
    function getTotalVotes(uint _electionId) public view returns (uint) {
        require(elections[_electionId].id != 0, "Cuoc bau cu khong ton tai");
        uint totalVotes = 0;
        for (uint i = 1; i <= elections[_electionId].candidatesCount; i++) {
            totalVotes += candidates[_electionId][i].voteCount;
        }
        return totalVotes;
    }
    
    /**
     * Lấy phần trăm phiếu của một ứng viên
     * Trả về phần trăm nhân với 100 (ví dụ: 50.5% = 5050)
     */
    function getCandidatePercentage(uint _electionId, uint _candidateId) public view returns (uint) {
        require(elections[_electionId].id != 0, "Cuoc bau cu khong ton tai");
        require(_candidateId > 0 && _candidateId <= elections[_electionId].candidatesCount, "Ung cu vien khong ton tai");
        
        uint totalVotes = getTotalVotes(_electionId);
        if (totalVotes == 0) return 0;
        
        uint candidateVotes = candidates[_electionId][_candidateId].voteCount;
        return (candidateVotes * 10000) / totalVotes; // Trả về phần trăm * 100
    }
    
    /**
     * Lấy trạng thái của cuộc bầu cử
     * 0 = Chưa bắt đầu, 1 = Đang diễn ra, 2 = Đã kết thúc
     */
    function getElectionStatus(uint _electionId) public view returns (uint) {
        require(elections[_electionId].id != 0, "Cuoc bau cu khong ton tai");
        
        if (block.timestamp < elections[_electionId].startDate) {
            return 0; // Chưa bắt đầu
        } else if (block.timestamp <= elections[_electionId].endDate) {
            return 1; // Đang diễn ra
        } else {
            return 2; // Đã kết thúc
        }
    }
    
    /**
     * Xác định ứng viên có số phiếu cao nhất (người chiến thắng)
     * Trả về ID của ứng viên chiến thắng, 0 nếu hòa hoặc chưa có phiếu
     */
    function getElectionWinner(uint _electionId) public view returns (uint) {
        require(elections[_electionId].id != 0, "Cuoc bau cu khong ton tai");
        
        uint winnerId = 0;
        uint maxVotes = 0;
        bool isTie = false;
        
        for (uint i = 1; i <= elections[_electionId].candidatesCount; i++) {
            uint voteCount = candidates[_electionId][i].voteCount;
            
            if (voteCount > maxVotes) {
                maxVotes = voteCount;
                winnerId = i;
                isTie = false;
            } else if (voteCount == maxVotes && maxVotes > 0) {
                isTie = true;
            }
        }
        
        // Nếu hòa hoặc chưa có phiếu, không có người chiến thắng
        if (isTie || maxVotes == 0) {
            return 0;
        }
        
        return winnerId;
    }
    
    /**
     * Lấy tất cả ứng viên và phiếu bầu của họ
     */
    function getAllCandidates(uint _electionId) public view 
        returns (uint[] memory ids, string[] memory names, uint[] memory votes) 
    {
        require(elections[_electionId].id != 0, "Cuoc bau cu khong ton tai");
        
        uint candidateCount = elections[_electionId].candidatesCount;
        ids = new uint[](candidateCount);
        names = new string[](candidateCount);
        votes = new uint[](candidateCount);
        
        for (uint i = 1; i <= candidateCount; i++) {
            ids[i - 1] = candidates[_electionId][i].id;
            names[i - 1] = candidates[_electionId][i].name;
            votes[i - 1] = candidates[_electionId][i].voteCount;
        }
        
        return (ids, names, votes);
    }
    
    /**
     * Lấy toàn bộ kết quả bầu cử
     */
    function getElectionResults(uint _electionId) public view 
        returns (
            uint electionId,
            string memory name,
            uint totalVotes,
            uint status,
            uint winnerId,
            uint[] memory candidateIds,
            string[] memory candidateNames,
            uint[] memory candidateVotes,
            uint[] memory candidatePercentages
        ) 
    {
        require(elections[_electionId].id != 0, "Cuoc bau cu khong ton tai");
        
        uint candidateCount = elections[_electionId].candidatesCount;
        candidateIds = new uint[](candidateCount);
        candidateNames = new string[](candidateCount);
        candidateVotes = new uint[](candidateCount);
        candidatePercentages = new uint[](candidateCount);
        
        uint total = getTotalVotes(_electionId);
        
        for (uint i = 1; i <= candidateCount; i++) {
            candidateIds[i - 1] = i;
            candidateNames[i - 1] = candidates[_electionId][i].name;
            candidateVotes[i - 1] = candidates[_electionId][i].voteCount;
            candidatePercentages[i - 1] = (total == 0) ? 0 : (candidateVotes[i - 1] * 10000) / total;
        }
        
        return (
            _electionId,
            elections[_electionId].name,
            total,
            getElectionStatus(_electionId),
            getElectionWinner(_electionId),
            candidateIds,
            candidateNames,
            candidateVotes,
            candidatePercentages
        );
    }
}